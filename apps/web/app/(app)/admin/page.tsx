import Link from "next/link";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { PageHeader } from "@/components/page-header";

export default function AdminPage() {
  return (
    <main className="page">
      <PageHeader folio="Admin" title="Administration" />
      <AdminTabs />
      <div className="grid gap-5 pt-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))" }}>
        <Link href="/admin/sectors" className="card flex flex-col gap-2 p-5 text-inherit no-underline">
          <h2 className="h-card">Sectors</h2>
          <p className="small muted">Create project sectors and see how their knowledge grows.</p>
        </Link>
        <Link href="/admin/access" className="card flex flex-col gap-2 p-5 text-inherit no-underline">
          <h2 className="h-card">Access</h2>
          <p className="small muted">Give members reader or maintainer roles, one cell at a time.</p>
        </Link>
      </div>
    </main>
  );
}
