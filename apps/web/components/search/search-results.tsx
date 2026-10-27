"use client";

import type { SearchResult } from "@cortex/knowledge/search-types";
import { SimilarityBar } from "./similarity-bar";
import { StatusBadge } from "./status-badge";

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
    <div role="listbox" aria-label="Search results" className="flex flex-col gap-3">
      {groupBySector(results).map((group) => (
        <section key={group.sectorId} aria-label={group.sectorName} className="flex flex-col gap-1">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase">
            <span aria-hidden className="inline-block size-2 rounded-full" style={{ backgroundColor: group.sectorColor }} />
            {group.sectorName}
          </h3>
          {group.items.map((result) => (
            <button
              key={result.chunkId}
              type="button"
              role="option"
              aria-selected={result.chunkId === activeId}
              onClick={() => onSelect(result)}
              className={`flex flex-col gap-1 rounded border p-2 text-left aria-selected:border-orange-700 ${result.status === "superseded" || result.status === "deprecated" ? "opacity-70" : ""}`}
            >
              <span className="flex items-center gap-2 font-medium">
                {result.docId !== null && <span className="font-mono text-xs">{result.docId}</span>}
                {result.title}
                <StatusBadge status={result.status} />
              </span>
              <span className="text-xs">{result.heading}</span>
              <span className="text-sm">{result.snippet}</span>
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs">{result.path}</span>
                <SimilarityBar similarity={result.similarity} />
              </span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
