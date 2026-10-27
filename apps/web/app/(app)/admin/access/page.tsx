import { Suspense } from "react";
import { getAccessMatrix } from "@cortex/access";
import { AccessMatrixTable } from "@/components/admin/access-matrix";
import { getAccessDeps } from "@/lib/access-deps";
import { requireOrgAdmin } from "@/lib/auth/caller";

async function AccessMatrixSection() {
  const caller = await requireOrgAdmin("/admin/access");
  const matrix = await getAccessMatrix(caller, getAccessDeps());
  return (
    <>
      {matrix.sectors.length === 0 ? <p>Create a project sector first.</p> : <AccessMatrixTable matrix={matrix} />}
    </>
  );
}

export default function AdminAccessPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Access</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <AccessMatrixSection />
      </Suspense>
    </main>
  );
}
