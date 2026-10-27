import { isOrgAdmin } from "@cortex/server-kit";
import { requireCaller } from "@/lib/auth/caller";
import { listMySectors } from "@/lib/sectors";

export default async function ProfilePage() {
  const caller = await requireCaller("/profile");
  const sectors = await listMySectors();
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{caller.name}</h1>
        <p>{caller.email}</p>
        {isOrgAdmin(caller) && <p className="w-fit rounded border px-2 py-0.5 text-sm">Organisation admin</p>}
      </header>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Sectors</h2>
        {sectors.length === 0 ? (
          <p>No sectors yet.</p>
        ) : (
          <ul>
            {sectors.map((sector) => (
              <li key={sector.id}>
                {sector.name}: {sector.role}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
