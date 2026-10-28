"use client";

import { useState } from "react";
import type { DiffRow } from "@cortex/proposals/types";
import { DiffView } from "@/components/diff/diff-view";
import { MarkdownView } from "@/components/files/markdown-view";

export function ProposalReview({ path, content, againstBase, againstCurrent, baseVersion }: { path: string; content: string; againstBase: DiffRow[]; againstCurrent: DiffRow[] | null; baseVersion: number | null }) {
  const [view, setView] = useState<"changes" | "preview">("changes");
  const [against, setAgainst] = useState<"base" | "current">("base");
  const rows = against === "current" && againstCurrent !== null ? againstCurrent : againstBase;
  return (
    <section className="flex flex-col gap-3" aria-label="Proposed content">
      <div className="flex flex-wrap items-center gap-3">
        <div className="seg" role="radiogroup" aria-label="View">
          <button type="button" role="radio" aria-checked={view === "changes"} onClick={() => setView("changes")}>
            Changes
          </button>
          <button type="button" role="radio" aria-checked={view === "preview"} onClick={() => setView("preview")}>
            Preview
          </button>
        </div>
        {view === "changes" && baseVersion !== null && (
          <div className="seg" role="radiogroup" aria-label="Compare">
            <button type="button" role="radio" aria-checked={against === "base"} onClick={() => setAgainst("base")}>
              Against base version (v{baseVersion})
            </button>
            <button type="button" role="radio" aria-checked={against === "current"} disabled={againstCurrent === null} onClick={() => setAgainst("current")}>
              Against current version
            </button>
          </div>
        )}
      </div>
      {view === "changes" ? (
        <DiffView key={against} path={path} rows={rows} />
      ) : (
        <div className="card p-6">
          <MarkdownView body={content} />
        </div>
      )}
    </section>
  );
}
