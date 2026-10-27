import { getPlatformStatus } from "@/lib/platform-status";

export async function PlatformStatusPanel() {
  const status = await getPlatformStatus();
  if (!status.ok) {
    return (
      <section role="alert" className="rounded-md border border-red-700 p-4">
        <h2 className="font-semibold">Platform check failed: {status.failedCheck}</h2>
        <p>{status.message}</p>
      </section>
    );
  }
  return (
    <section className="rounded-md border p-4">
      <h2 className="font-semibold">Connected to Appwrite {status.version}</h2>
      <p>
        Project <code>{status.project}</code>
      </p>
    </section>
  );
}
