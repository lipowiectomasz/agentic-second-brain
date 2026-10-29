import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ID, Proxy, Query, Sites } from "node-appwrite";
import type { Adapter, BuildRuntime, Framework } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { loadServerEnv } from "@cortex/config";
import { createAdminClient } from "@cortex/server-kit";
import { repositoryRoot } from "../repository-paths";
import { packSite, SiteDeployError } from "../site/archive";
import type { SiteEnv, SiteSettings } from "../site/plan";
import { deployedHashKey, deploymentHash, isSecretKey, logTail, needsDeployment, ruleAction, settingsDiffer, siteId, siteSettings, siteVariables, variableOperations } from "../site/plan";
import { warmUp } from "../site/warm-up";

const buildLimitMs = 600000;
const pollMs = 5000;
const warmUpLimitMs = 90000;
const failedStatuses = new Set(["failed", "canceled"]);

function siteEnv(source: NodeJS.ProcessEnv): SiteEnv {
  const names = ["CORTEX_SITE_DOMAIN", "CORTEX_SITE_URL", "CORTEX_FUNCTION_API_ENDPOINT", "CORTEX_WEB_API_KEY", "NEXT_PUBLIC_APPWRITE_ENDPOINT", "NEXT_PUBLIC_APPWRITE_PROJECT_ID"] as const;
  const missing = names.filter((name) => source[name] === undefined || source[name] === "");
  if (missing.length > 0) throw new SiteDeployError("missing_env", missing.join(", "));
  return Object.fromEntries(names.map((name) => [name, source[name] as string])) as unknown as SiteEnv;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runSiteDeploy(log: (line: string) => void): Promise<number> {
  const env = loadServerEnv(process.env);
  const site = siteEnv(process.env);
  const client = createAdminClient(env);
  const sites = new Sites(client);
  const proxy = new Proxy(client);
  const outDir = await mkdtemp(path.join(tmpdir(), "cortex-site-"));
  try {
    const bundle = await packSite(repositoryRoot, outDir);
    log(`archive: ${bundle.files.length} files`);

    const settings = { ...siteSettings, framework: siteSettings.framework as Framework, adapter: siteSettings.adapter as Adapter, buildRuntime: siteSettings.buildRuntime as BuildRuntime };
    const existing = await sites.get({ siteId }).catch(() => null);
    if (existing === null) {
      await sites.create({ siteId, name: "Cortex web", ...settings });
      log(`site ${siteId}: created`);
    } else if (settingsDiffer(existing as unknown as Partial<SiteSettings>)) {
      await sites.update({ siteId, name: "Cortex web", ...settings });
      log(`site ${siteId}: settings updated`);
    }

    const desired = siteVariables(env, site);
    const current = await sites.listVariables({ siteId, queries: [Query.limit(100)] });
    const operations = variableOperations(desired, current.variables);
    for (const operation of operations) {
      if (operation.kind === "create") await sites.createVariable({ siteId, variableId: ID.unique(), key: operation.key, value: desired[operation.key] ?? "", secret: isSecretKey(operation.key) });
      else if (operation.kind === "update") await sites.updateVariable({ siteId, variableId: operation.id, key: operation.key, value: desired[operation.key] ?? "", secret: isSecretKey(operation.key) });
      else await sites.deleteVariable({ siteId, variableId: operation.id });
    }
    if (operations.length > 0) log(`variables: ${operations.map((operation) => `${operation.kind} ${operation.key}`).join(", ")}`);

    const target = deploymentHash(bundle.hash, desired);
    const latest = await sites.get({ siteId });
    const active = latest.deploymentId === "" ? null : await sites.getDeployment({ siteId, deploymentId: latest.deploymentId }).catch(() => null);
    const storedHash = current.variables.find((variable) => variable.key === deployedHashKey)?.value ?? null;
    if (needsDeployment({ deploymentHash: target, storedHash, activeReady: active?.status === "ready" })) {
      const created = await sites.createDeployment({ siteId, code: InputFile.fromPath(bundle.archivePath, "site.tar.gz"), activate: true, installCommand: siteSettings.installCommand, buildCommand: siteSettings.buildCommand, outputDirectory: siteSettings.outputDirectory });
      log(`deployment ${created.$id}: building`);
      const deadline = Date.now() + buildLimitMs;
      for (;;) {
        const deployment = await sites.getDeployment({ siteId, deploymentId: created.$id });
        if (deployment.status === "ready") {
          log(`deployment ${created.$id}: ready in ${deployment.buildDuration} s`);
          break;
        }
        if (failedStatuses.has(deployment.status)) {
          log(logTail(deployment.buildLogs, 40));
          throw new SiteDeployError("build_failed", created.$id);
        }
        if (Date.now() >= deadline) throw new SiteDeployError("build_timeout", created.$id);
        await sleep(pollMs);
      }
      const hashVariable = (await sites.listVariables({ siteId, queries: [Query.limit(100)] })).variables.find((variable) => variable.key === deployedHashKey);
      if (hashVariable === undefined) await sites.createVariable({ siteId, variableId: ID.unique(), key: deployedHashKey, value: target, secret: false });
      else await sites.updateVariable({ siteId, variableId: hashVariable.$id, key: deployedHashKey, value: target, secret: false });
    } else {
      log("site up to date");
    }

    const rules = await proxy.listRules({ queries: [Query.equal("domain", [site.CORTEX_SITE_DOMAIN])] });
    const action = ruleAction(site.CORTEX_SITE_DOMAIN, rules.rules);
    if (typeof action === "object") throw new SiteDeployError("domain_taken", `${site.CORTEX_SITE_DOMAIN} serves ${action.conflict}`);
    if (action === "create") {
      await proxy.createSiteRule({ domain: site.CORTEX_SITE_DOMAIN, siteId });
      log(`domain ${site.CORTEX_SITE_DOMAIN}: bound`);
    }

    await warmUp(new URL(env.APPWRITE_INTERNAL_ENDPOINT ?? env.APPWRITE_ENDPOINT).origin, site.CORTEX_SITE_DOMAIN, ["/", "/login"], warmUpLimitMs);
    log(`site ready: ${site.CORTEX_SITE_URL}`);
    return 0;
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSiteDeploy((line) => process.stdout.write(`${line}\n`))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(error instanceof SiteDeployError && error.code === "missing_env" ? 2 : 1);
    });
}
