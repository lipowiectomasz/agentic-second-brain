# Readiness marker race in the test dependency container

## Expected

The isolated test stack used for the release gate in "Production deployment readiness" has a dependency container that runs `npm ci` and installs the workspace packages before the applications start. When installation finishes, it writes a readiness marker file. Its healthcheck reports healthy once the marker exists, and the CMS container waits for that health state before it starts. So the CMS should never start against a half-installed `node_modules`.

## What happened

After the dependency container restarted, the CMS sometimes started while `npm ci` was still running. The CMS then failed with missing or incomplete modules, or behaved unpredictably. The failures were intermittent: a clean first start usually worked, while restarts and reruns of the stack were the ones that broke.

## Why

The readiness marker outlived the container restart. It sat in storage that persisted between runs, and nothing deleted it at the start of a new installation. On restart the healthcheck saw the old marker and reported healthy straight away, even though `npm ci` had only just started and was rebuilding `node_modules` from scratch. The CMS trusted the stale signal and started during the reinstall.

A second, smaller issue made this worse. The healthcheck window was too short for a full clean install on a cold cache. Even without the stale marker, a slow install could exhaust the retries and mark the container unhealthy, or push people to loosen the dependency condition.

## What changed

The dependency container now deletes the readiness marker before `npm ci` starts. A healthy state can therefore only mean "this run's installation finished". The healthcheck also got a longer window (start period and retries) so that a full clean install fits inside it. Together these two changes removed the race, and restarts and reruns of the test stack became deterministic.

The general rule: a readiness marker has to be tied to the lifetime of the work it signals. Create it at the end and clear it at the beginning, and never let it outlive a restart. Size the healthcheck to the slowest legitimate path, not the typical one. The same rehearsal also turned up "Production build depended on a running CMS".
