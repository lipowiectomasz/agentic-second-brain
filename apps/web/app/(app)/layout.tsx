import { Suspense } from "react";
import { headers } from "next/headers";
import { AppNav } from "@/components/nav/app-nav";
import { requireCaller } from "@/lib/auth/caller";
import { listMySectors } from "@/lib/sectors";

export const instant = false;

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-cortex-path") ?? "/";
  const caller = await requireCaller(path);
  const mySectors = await listMySectors(caller);
  const reviewsRequests = mySectors.some((sector) => sector.myRole === "maintainer");
  const sectors = mySectors.map((sector) => ({ id: sector.id, name: sector.name, color: sector.color }));
  return (
    <>
      <AppNav caller={caller} reviewsRequests={reviewsRequests} sectors={sectors} />
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
