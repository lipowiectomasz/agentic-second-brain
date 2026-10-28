"use client";

import type { SearchResult } from "@cortex/knowledge/search-types";
import { DocId } from "@/components/documents/doc-id";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { sectorStyle } from "@/components/sectors/sector-badge";
import { SimilarityBar } from "./similarity-bar";

export function groupBySector(results: SearchResult[]): Array<{ sectorId: string; sectorName: string; sectorColor: string; items: SearchResult[] }> {
  const groups = new Map<string, { sectorId: string; sectorName: string; sectorColor: string; items: SearchResult[] }>();
  for (const result of results) {
    const group = groups.get(result.sectorId) ?? { sectorId: result.sectorId, sectorName: result.sectorName, sectorColor: result.sectorColor, items: [] };
    group.items.push(result);
    groups.set(result.sectorId, group);
  }
  return [...groups.values()];
}

export function SearchResults({ results, activeId, onSelect }: { results: SearchResult[]; activeId: string | null; onSelect: (result: SearchResult) => void }) {
  return (
    <div role="listbox" aria-label="Search results" className="flex flex-col gap-1 px-2 pt-1.5 pb-2.5">
      {groupBySector(results).map((group) => (
        <section key={group.sectorId} aria-label={group.sectorName} className="flex flex-col gap-0.5" style={sectorStyle(group.sectorColor)}>
          <h3 className="flex items-center gap-2 px-2.5 pt-3 pb-1">
            <span aria-hidden className="dot" />
            <span className="serif text-[15px] leading-5 italic" style={{ color: "var(--c)" }}>
              {group.sectorName}
            </span>
            <span aria-hidden className="ml-1.5 flex-1 border-t border-border" />
            <span className="folio">{group.items.length}</span>
          </h3>
          <div className="stagger flex flex-col gap-0.5">
            {group.items.map((result) => {
              const stale = result.status === "superseded" || result.status === "deprecated";
              return (
                <button
                  key={result.chunkId}
                  type="button"
                  role="option"
                  aria-selected={result.chunkId === activeId}
                  onClick={() => onSelect(result)}
                  className={`result-option ${stale ? "is-dim" : ""}`}
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                      {result.docId !== null && <DocId id={result.docId} />}
                      <span className="r-title serif truncate text-[17px] leading-6">{result.title}</span>
                      {stale && <DocumentStatusBadge status={result.status === "superseded" ? "superseded" : "deprecated"} sealed={false} />}
                    </span>
                    <span className="xsmall muted">{result.heading}</span>
                    <span className="r-snip small clamp-2 mt-1">{result.snippet}</span>
                    <span className="mt-1 flex min-w-0 items-center gap-2.5">
                      <span className="mono xsmall muted truncate">{result.path}</span>
                      <span className="badge badge-kind flex-none">{result.kind}</span>
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-2.5">
                    <SimilarityBar similarity={result.similarity} />
                    {result.chunkId === activeId && <kbd className="kbd hide-sm">Enter</kbd>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
