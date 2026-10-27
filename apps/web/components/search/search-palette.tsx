"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { SearchResult } from "@cortex/knowledge/search-types";
import { searchAction } from "@/app/(app)/actions/search";
import type { Filters, PaletteSector } from "./filter-chips";
import { FilterChips } from "./filter-chips";
import { SearchResults } from "./search-results";

type PaletteState = { status: "idle" } | { status: "loading" } | { status: "results"; results: SearchResult[] } | { status: "error" };

const debounceMs = 300;

export function SearchPalette({ sectors }: { sectors: PaletteSector[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const requestCounter = useRef(0);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({ sectorIds: [], kinds: [], includeSuperseded: false });
  const [state, setState] = useState<PaletteState>({ status: "idle" });
  const [activeIndex, setActiveIndex] = useState(0);
  const [, startTransition] = useTransition();

  function open() {
    dialog.current?.showModal();
    input.current?.focus();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialog.current?.open === true) dialog.current.close();
        else open();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function runSearch(nextQuery: string, nextFilters: Filters) {
    const request = requestCounter.current + 1;
    requestCounter.current = request;
    if (nextQuery.trim() === "") {
      setState({ status: "idle" });
      return;
    }
    setState({ status: "loading" });
    window.setTimeout(() => {
      if (requestCounter.current !== request) return;
      startTransition(async () => {
        const response = await searchAction({
          query: nextQuery,
          ...(nextFilters.sectorIds.length > 0 ? { sectorIds: nextFilters.sectorIds } : {}),
          ...(nextFilters.kinds.length > 0 ? { kinds: nextFilters.kinds } : {}),
          includeSuperseded: nextFilters.includeSuperseded,
        });
        if (requestCounter.current !== request) return;
        if (!response.ok && response.error === "unauthenticated") {
          router.push("/login");
          return;
        }
        setActiveIndex(0);
        setState(response.ok ? { status: "results", results: response.results } : { status: "error" });
      });
    }, debounceMs);
  }

  function select(result: SearchResult) {
    dialog.current?.close();
    router.push(`/files/${result.fileId}#${result.anchor}`);
  }

  const results = state.status === "results" ? state.results : [];

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      const result = results[activeIndex];
      if (result !== undefined) {
        event.preventDefault();
        select(result);
      }
    }
  }

  return (
    <>
      <button type="button" onClick={open} className="flex items-center gap-2 rounded border px-3 py-1 text-sm">
        Search
        <kbd className="rounded border px-1 font-mono text-xs">Ctrl K</kbd>
      </button>
      <dialog ref={dialog} aria-label="Search the brain" className="m-auto w-full max-w-2xl rounded-lg border p-0 backdrop:bg-black/40">
        <div className="flex flex-col gap-3 p-4">
          <input
            ref={input}
            type="search"
            aria-label="Search query"
            placeholder="Ask anything about your brain"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              runSearch(event.target.value, filters);
            }}
            onKeyDown={onInputKeyDown}
            className="w-full rounded border px-3 py-2"
          />
          <FilterChips
            sectors={sectors}
            filters={filters}
            onChange={(next) => {
              setFilters(next);
              runSearch(query, next);
            }}
          />
          <div className="max-h-[60vh] overflow-y-auto" aria-live="polite">
            {state.status === "idle" && <p className="text-sm">Ask anything about your brain</p>}
            {state.status === "loading" && (
              <div aria-label="Loading results" className="flex flex-col gap-2">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="h-14 animate-pulse rounded bg-neutral-100" />
                ))}
              </div>
            )}
            {state.status === "error" && <p className="text-sm">Search is unavailable. Try again.</p>}
            {state.status === "results" && results.length === 0 && <p className="text-sm">No matches. Try describing the problem in other words.</p>}
            {state.status === "results" && results.length > 0 && <SearchResults results={results} activeId={results[activeIndex]?.chunkId ?? null} onSelect={select} />}
          </div>
          <p className="text-xs">
            <kbd className="font-mono">↑↓</kbd> select · <kbd className="font-mono">Enter</kbd> open · <kbd className="font-mono">Esc</kbd> close
          </p>
        </div>
      </dialog>
    </>
  );
}
