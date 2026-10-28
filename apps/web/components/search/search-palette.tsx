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
      <button type="button" onClick={open} className="search-trigger">
        <SearchIcon />
        <span className="flex-1 text-left">Search</span>
        <kbd className="kbd">Ctrl K</kbd>
      </button>
      <dialog ref={dialog} aria-label="Search the brain" className="palette raised">
        <div className="flex h-16 flex-none items-center gap-3 border-b border-border px-4">
          <span className="hide-sm muted flex-none">
            <SearchIcon />
          </span>
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
            className="palette-input h-11 min-w-0 flex-1 border-0 bg-transparent text-[19px] leading-7 outline-none placeholder:text-muted-foreground"
          />
          {state.status === "loading" && <span className="spinner muted" aria-hidden />}
          <kbd className="kbd hide-sm">Esc</kbd>
        </div>
        <div className="flex-none border-b border-border px-4 py-2.5">
          <FilterChips
            sectors={sectors}
            filters={filters}
            onChange={(next) => {
              setFilters(next);
              runSearch(query, next);
            }}
          />
        </div>
        <div className="palette-results" aria-live="polite">
          {state.status === "idle" && (
            <div className="flex flex-col gap-2.5 px-6 pt-5 pb-6">
              <p className="folio">Ask anything about your brain</p>
              <p className="xsmall muted">Search reads meaning, not keywords. Describe the problem in your own words.</p>
            </div>
          )}
          {state.status === "loading" && (
            <div aria-label="Loading results" className="flex flex-col gap-4.5 px-5 pt-3.5 pb-5">
              {[0, 1, 2].map((row) => (
                <div key={row} className="grid grid-cols-[1fr_90px] gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="sk block h-4 w-[55%]" />
                    <span className="sk block h-2.5 w-[30%]" />
                    <span className="sk block h-2.5 w-[90%]" />
                  </div>
                  <span className="sk block h-2 w-full" />
                </div>
              ))}
            </div>
          )}
          {state.status === "error" && <p className="small px-6 py-10 text-center">Search is unavailable. Try again.</p>}
          {state.status === "results" && results.length === 0 && (
            <p className="small muted flex flex-col items-center gap-2.5 px-6 py-10 text-center">
              <span className="serif text-xl text-foreground">No matches.</span> Try describing the problem in other words.
            </p>
          )}
          {state.status === "results" && results.length > 0 && <SearchResults results={results} activeId={results[activeIndex]?.chunkId ?? null} onSelect={select} />}
        </div>
        <p className="xsmall muted flex flex-none items-center gap-2 border-t border-border px-4 py-2.5">
          <kbd className="kbd">↑↓</kbd> select <kbd className="kbd">Enter</kbd> open <kbd className="kbd">Esc</kbd> close
        </p>
      </dialog>
    </>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="7" cy="7" r="4.8" />
      <path d="m10.5 10.5 3.5 3.5" />
    </svg>
  );
}
