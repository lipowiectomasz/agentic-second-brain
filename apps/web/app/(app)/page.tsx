import { Suspense } from "react";
import { requireCaller } from "@/lib/auth/caller";

async function Greeting() {
  const caller = await requireCaller("/");
  return <h1 className="h-display">Welcome, {caller.name}</h1>;
}

export default function HomePage() {
  return (
    <main className="page dot-grid">
      <Suspense fallback={<div className="sk h-11 w-96" />}>
        <Greeting />
      </Suspense>
      <p className="muted">The brain map will appear here. Press <kbd className="kbd">Ctrl</kbd> <kbd className="kbd">K</kbd> to search.</p>
    </main>
  );
}
