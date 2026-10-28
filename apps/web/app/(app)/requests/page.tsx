import { Suspense } from "react";
import { TablesDB } from "node-appwrite";
import { listPendingRequests } from "@cortex/access";
import { PageHeader } from "@/components/page-header";
import { RequestDecision } from "@/components/sectors/request-decision";
import { SectorBadge } from "@/components/sectors/sector-badge";
import { getAccessDeps } from "@/lib/access-deps";
import { requireCaller } from "@/lib/auth/caller";
import { getSessionClient } from "@/lib/auth/session-client";

async function RequestList() {
  const caller = await requireCaller("/requests");
  const requests = await listPendingRequests(caller, new TablesDB(await getSessionClient()), getAccessDeps());
  return (
    <>
      {requests.length === 0 ? (
        <p className="muted">No pending requests.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.id} className="card flex flex-col gap-3 p-5">
              <p className="flex flex-wrap items-center gap-2">
                <strong className="font-medium">{request.userName}</strong> asks for <span className="badge badge-role">{request.role === "maintainer" ? "Maintainer" : "Reader"}</span> in <SectorBadge name={request.sector.name} color={request.sector.color} />
              </p>
              {request.message !== null && <p className="serif muted italic" style={{ fontSize: 17 }}>&ldquo;{request.message}&rdquo;</p>}
              <p className="folio">{new Date(request.createdAt).toISOString().slice(0, 16).replace("T", " ")}</p>
              <RequestDecision requestId={request.id} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function RequestsPage() {
  return (
    <main className="page">
      <PageHeader folio="Your sectors" title="Access requests" />
      <hr className="rule-double" />
      <Suspense fallback={<div className="sk h-32 w-full" />}>
        <RequestList />
      </Suspense>
    </main>
  );
}
