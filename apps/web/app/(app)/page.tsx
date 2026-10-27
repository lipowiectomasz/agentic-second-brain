import { requireCaller } from "@/lib/auth/caller";

export default async function HomePage() {
  const caller = await requireCaller("/");
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Welcome, {caller.name}</h1>
      <p>The brain map will appear here.</p>
    </main>
  );
}
