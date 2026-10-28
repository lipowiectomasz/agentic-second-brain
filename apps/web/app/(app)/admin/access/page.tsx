import { Suspense } from "react";
import { getAccessMatrix } from "@cortex/access";
import { AccessMatrixTable } from "@/components/admin/access-matrix";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { PageHeader } from "@/components/page-header";
import { getAccessDeps } from "@/lib/access-deps";
import { requireOrgAdmin } from "@/lib/auth/caller";

async function AccessMatrixSection() {
  const caller = await requireOrgAdmin("/admin/access");
  const matrix = await getAccessMatrix(caller, getAccessDeps());
  return (
    <>
      {matrix.sectors.length === 0 ? <p className="muted pt-3">Create a project sector first.</p> : <AccessMatrixTable matrix={matrix} />}
    </>
  );
}

export default function AdminAccessPage() {
  return (
    <main className="page">
      <PageHeader folio="Admin" title="Access">
        <p className="small muted max-w-md">
          <strong className="font-medium text-foreground">Reader</strong> searches and reads. <strong className="font-medium text-foreground">Maintainer</strong> also pushes files and approves requests. Changes save as you make them.
        </p>
      </PageHeader>
      <AdminTabs />
      <Suspense fallback={<div className="sk h-64 w-full" />}>
        <AccessMatrixSection />
      </Suspense>
    </main>
  );
}
