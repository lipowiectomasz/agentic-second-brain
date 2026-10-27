import { Suspense } from "react";
import { TablesDB } from "node-appwrite";
import { listPendingRequests } from "@cortex/access";
import { RequestDecision } from "@/components/sectors/request-decision";
import { SectorSwatch } from "@/components/sectors/sector-swatch";
import { getAccessDeps } from "@/lib/access-deps";
import { requireCaller } from "@/lib/auth/caller";
import { getSessionClient } from "@/lib/auth/session-client";

async function RequestList() {
  const caller = await requireCaller("/requests");
  const requests = await listPendingRequests(caller, new TablesDB(await getSessionClient()), getAccessDeps());
  return (
    <>
      {requests.length === 0 ? (
        <p>No pending requests.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.id} className="flex flex-col gap-2 rounded-lg border p-4">
              <p>
                <strong>{request.userName}</strong> asks for <strong>{request.role === "maintainer" ? "Maintainer" : "Reader"}</strong> in{" "}
                <span className="inline-flex items-center gap-1">
                  <SectorSwatch color={request.sector.color} />
                  {request.sector.name}
                </span>
              </p>
              {request.message !== null && <blockquote className="border-l-2 pl-3 text-sm">{request.message}</blockquote>}
              <p className="text-sm">{new Date(request.createdAt).toISOString().slice(0, 16).replace("T", " ")}</p>
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
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Access requests</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <RequestList />
      </Suspense>
    </main>
  );
}
