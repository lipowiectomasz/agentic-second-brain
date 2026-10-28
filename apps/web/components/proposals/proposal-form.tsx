"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { ProposalFormState } from "@/app/(app)/proposals/actions";
import { submitProposalAction } from "@/app/(app)/proposals/actions";
import { MarkdownView } from "@/components/files/markdown-view";
import { Banner } from "@/components/ui/banner";

export interface ProposalDefaults {
  kind: "standard" | "procedure";
  targetPath: string;
  baseVersion: number | null;
  title: string;
  content: string;
  changeOf: { fileId: string; path: string; version: number } | null;
}

const maxBytes = 262144;

export function ProposalForm({ defaults }: { defaults: ProposalDefaults }) {
  const [state, action, pending] = useActionState<ProposalFormState, FormData>(submitProposalAction, { status: "idle" });
  const [kind, setKind] = useState(defaults.kind);
  const [title, setTitle] = useState(defaults.title);
  const [content, setContent] = useState(defaults.content);
  const [rationale, setRationale] = useState("");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const bytes = new TextEncoder().encode(content).length;
  const fieldError = (field: string) => (state.status === "error" && state.field === field ? state.message : null);

  return (
    <div className="flex flex-col gap-5">
      {defaults.changeOf !== null && (
        <Banner
          tone="info"
          action={
            <Link href={`/files/${defaults.changeOf.fileId}`} className="small font-medium underline">
              Open current version
            </Link>
          }
        >
          <p>
            You are proposing a change to <span className="mono">{defaults.changeOf.path}</span> (v{defaults.changeOf.version}).
          </p>
        </Banner>
      )}
      {state.status === "error" && (
        <Banner tone="danger">
          <p className="font-medium">This proposal can&apos;t be submitted yet.</p>
          <p>{state.message}</p>
        </Banner>
      )}
      <div className="seg self-start lg:hidden" role="tablist" aria-label="Editor">
        <button type="button" role="tab" aria-selected={tab === "write"} aria-checked={tab === "write"} onClick={() => setTab("write")}>
          Write
        </button>
        <button type="button" role="tab" aria-selected={tab === "preview"} aria-checked={tab === "preview"} onClick={() => setTab("preview")}>
          Preview
        </button>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <form action={action} className={`flex flex-col gap-4.5 ${tab === "preview" ? "hidden lg:flex" : ""}`}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="baseVersion" value={defaults.baseVersion ?? ""} />
          <div className="field">
            <div className="flex justify-between">
              <label className="label" htmlFor="proposal-title">
                Title
              </label>
              <span className="xsmall muted">{title.length} / 200</span>
            </div>
            <input id="proposal-title" name="title" className="input" maxLength={200} required value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="field">
            <span className="label" id="proposal-kind">
              Kind
            </span>
            <div className="seg self-start" role="radiogroup" aria-labelledby="proposal-kind">
              {(["standard", "procedure"] as const).map((option) => (
                <button key={option} type="button" role="radio" aria-checked={kind === option} onClick={() => setKind(option)} disabled={defaults.changeOf !== null}>
                  {option === "standard" ? "Standard" : "Procedure"}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="proposal-path">
              Target path
            </label>
            <input id="proposal-path" name="targetPath" className="input mono" required defaultValue={defaults.targetPath} readOnly={defaults.changeOf !== null} aria-invalid={fieldError("targetPath") !== null} />
            <span className="hint">
              Must start with <span className="mono">standards/</span> or <span className="mono">procedures/</span> and end with <span className="mono">.md</span>
            </span>
            {fieldError("targetPath") !== null && <p className="err">{fieldError("targetPath")}</p>}
          </div>
          <div className="field">
            <div className="flex justify-between">
              <label className="label" htmlFor="proposal-content">
                Content · Markdown
              </label>
              <span className={`xsmall ${bytes > maxBytes ? "text-danger" : "muted"}`}>
                {(bytes / 1024).toFixed(1)} KB of 256 KB · {content.length} characters
              </span>
            </div>
            <textarea id="proposal-content" name="content" className="input mono min-h-72" required value={content} onChange={(event) => setContent(event.target.value)} aria-invalid={fieldError("content") !== null} />
            {fieldError("content") !== null && <p className="err">{fieldError("content")}</p>}
          </div>
          <div className="field">
            <div className="flex justify-between">
              <label className="label" htmlFor="proposal-rationale">
                Rationale
              </label>
              <span className="xsmall muted">{rationale.length} / 4000</span>
            </div>
            <textarea id="proposal-rationale" name="rationale" className="input min-h-24" maxLength={4000} required placeholder="Why should the whole team follow this?" value={rationale} onChange={(event) => setRationale(event.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn-primary" disabled={pending || bytes > maxBytes}>
              {pending && <span className="spinner" aria-hidden />}
              Submit proposal
            </button>
            <Link href="/proposals" className="btn btn-ghost">
              Cancel
            </Link>
          </div>
          <p className="xsmall muted">
            You can also submit from the terminal: <code className="mono">cortex propose &lt;file&gt; --as standard</code>
          </p>
        </form>
        <section aria-label="Preview" className={`flex flex-col gap-3 ${tab === "write" ? "hidden lg:flex" : ""}`}>
          <p className="folio">
            Preview <span className="normal-case">· updates as you type</span>
          </p>
          <div className="card p-6">
            <MarkdownView body={content === "" ? "_Nothing to preview yet._" : content} />
          </div>
        </section>
      </div>
    </div>
  );
}
