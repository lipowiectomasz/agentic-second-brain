import { Suspense } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { PlatformStatusPanel } from "@/components/platform-status";

export default function StatusPage() {
  return (
    <main className="dot-grid min-h-screen">
      <div className="page max-w-xl">
        <Wordmark />
        <p className="folio">Platform status</p>
        <Suspense fallback={<p className="small muted">Checking the platform...</p>}>
          <PlatformStatusPanel />
        </Suspense>
      </div>
    </main>
  );
}
