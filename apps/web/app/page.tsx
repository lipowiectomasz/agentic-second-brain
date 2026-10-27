import { Suspense } from "react";
import { PlatformStatusPanel } from "@/components/platform-status";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold">Cortex</h1>
      <Suspense fallback={<p>Checking the platform...</p>}>
        <PlatformStatusPanel />
      </Suspense>
    </main>
  );
}
