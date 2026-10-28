import { getPlatformStatus } from "@/lib/platform-status";

export async function PlatformStatusPanel() {
  const status = await getPlatformStatus();
  if (!status.ok) {
    return (
      <section role="alert" className="card flex flex-col gap-2 border-danger p-5">
        <span className="badge badge-danger self-start">Unavailable</span>
        <h2 className="h-card">Platform check failed: {status.failedCheck}</h2>
        <p className="small muted">{status.message}</p>
      </section>
    );
  }
  return (
    <section className="card flex flex-col gap-2 p-5">
      <span className="badge badge-success self-start">Connected</span>
      <h2 className="h-card">Connected to Appwrite {status.version}</h2>
      <p className="small muted">
        Project <code className="mono">{status.project}</code>
      </p>
    </section>
  );
}
