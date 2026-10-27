import { Suspense } from "react";
import { ForbiddenError } from "@cortex/server-kit";
import { Forbidden } from "@/components/auth/forbidden";
import { requireOrgAdmin } from "@/lib/auth/caller";

async function AdminGate({ children }: { children: React.ReactNode }) {
  try {
    await requireOrgAdmin("/admin");
  } catch (error) {
    if (error instanceof ForbiddenError) return <Forbidden />;
    throw error;
  }
  return <>{children}</>;
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<p className="px-4 py-10">Loading...</p>}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
