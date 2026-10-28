import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { PageHeader } from "@/components/page-header";
import { TokensTable } from "@/components/tokens/tokens-table";
import { requireOrgAdmin } from "@/lib/auth/caller";
import { getTokenService } from "@/lib/tokens/service";

export const metadata: Metadata = { title: "Tokens" };

async function AllTokens() {
  const caller = await requireOrgAdmin("/admin/tokens");
  return <TokensTable tokens={await getTokenService().listAll(caller)} showOwner />;
}

export default function AdminTokensPage() {
  return (
    <main className="page">
      <PageHeader folio="Admin" title="Tokens" />
      <AdminTabs />
      <Suspense fallback={<p className="small muted">Loading tokens...</p>}>
        <AllTokens />
      </Suspense>
    </main>
  );
}
