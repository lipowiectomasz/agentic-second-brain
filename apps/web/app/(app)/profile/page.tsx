import { Suspense } from "react";
import { isOrgAdmin } from "@cortex/server-kit";
import { SectorBadge } from "@/components/sectors/sector-badge";
import { requireCaller } from "@/lib/auth/caller";
import { listMySectors } from "@/lib/sectors";

async function ProfileDetails() {
  const caller = await requireCaller("/profile");
  const sectors = await listMySectors(caller);
  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="folio">Profile</p>
        <h1 className="h-display">{caller.name}</h1>
        <p className="mono small muted">{caller.email}</p>
        {isOrgAdmin(caller) && <span className="badge badge-admin self-start">Organisation admin</span>}
      </header>
      <hr className="rule-double" />
      <section className="flex flex-col gap-3">
        <h2 className="h-section">Sectors</h2>
        {sectors.length === 0 ? (
          <p className="muted">No sectors yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sectors.map((sector) => (
              <li key={sector.id} className="flex items-center gap-2">
                <SectorBadge name={sector.name} color={sector.color} />
                <span>
                  {sector.name}: {sector.myRole === "maintainer" ? "Maintainer" : "Reader"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function ProfilePage() {
  return (
    <main className="page">
      <Suspense fallback={<div className="sk h-40 w-full" />}>
        <ProfileDetails />
      </Suspense>
    </main>
  );
}
