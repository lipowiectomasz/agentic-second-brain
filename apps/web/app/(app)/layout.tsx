import { Suspense } from "react";
import { headers } from "next/headers";
import { AppNav } from "@/components/nav/app-nav";
import { requireCaller } from "@/lib/auth/caller";

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-cortex-path") ?? "/";
  const caller = await requireCaller(path);
  return (
    <>
      <AppNav caller={caller} />
      {children}
    </>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<p className="px-4 py-3">Loading...</p>}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}
