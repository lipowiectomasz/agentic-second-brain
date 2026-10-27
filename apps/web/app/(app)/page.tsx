import { Suspense } from "react";
import { requireCaller } from "@/lib/auth/caller";

async function Greeting() {
  const caller = await requireCaller("/");
  return <h1 className="text-2xl font-semibold">Welcome, {caller.name}</h1>;
}

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10">
      <Suspense fallback={<p>Loading...</p>}>
        <Greeting />
      </Suspense>
      <p>The brain map will appear here.</p>
    </main>
  );
}
