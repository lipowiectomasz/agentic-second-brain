import type { Metadata } from "next";
import { Suspense } from "react";
import { maxActiveTokens } from "@cortex/tokens";
import { CopyPathButton } from "@/components/documents/copy-path-button";
import { PageHeader } from "@/components/page-header";
import { CreateTokenForm } from "@/components/tokens/create-token-form";
import { TokensTable } from "@/components/tokens/tokens-table";
import { requireCaller } from "@/lib/auth/caller";
import { getTokenService } from "@/lib/tokens/service";

export const metadata: Metadata = { title: "Access tokens" };

async function Tokens() {
  const caller = await requireCaller("/settings/tokens");
  const tokens = await getTokenService().listOwn(caller);
  const active = tokens.filter((token) => token.status === "active").length;
  return (
    <div className="flex flex-wrap items-start gap-8">
      <div className="flex min-w-0 max-w-[420px] flex-[1_1_340px] flex-col gap-5">
        <CreateTokenForm limitReached={active >= maxActiveTokens} />
        <div className="flex flex-col gap-2.5 rounded-md border border-dashed border-input px-5 py-4.5">
          <h3 className="label">Use this token with the Cortex CLI</h3>
          <div className="relative">
            <pre className="mono sunken m-0 overflow-x-auto rounded-sm py-2.5 pr-12 pl-3 text-[13px] leading-5">
              <span className="muted">$</span> cortex login
            </pre>
            <span className="absolute top-0.5 right-0.5">
              <CopyPathButton path="cortex login" />
            </span>
          </div>
          <p className="xsmall muted">Paste the token when asked. It is stored only on your machine.</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
        <h2 className="h-card">
          Your tokens{" "}
          <span className="small muted font-sans">
            · {active} of {maxActiveTokens} active
          </span>
        </h2>
        <TokensTable tokens={tokens} />
      </div>
    </div>
  );
}

export default function TokensPage() {
  return (
    <main className="page">
      <PageHeader folio="Account" title="Access tokens" />
      <p className="muted -mt-4 max-w-[620px]">Tokens let the Cortex CLI and your coding assistant read, or push to, the sectors you can reach. They act as you.</p>
      <hr className="rule-double" />
      <Suspense fallback={<p className="small muted">Loading tokens...</p>}>
        <Tokens />
      </Suspense>
    </main>
  );
}
