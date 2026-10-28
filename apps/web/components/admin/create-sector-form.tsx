"use client";

import { useActionState, useState } from "react";
import { deriveSlug } from "@cortex/core/slug";
import { sectorColors } from "@cortex/core/sector-colors";
import type { ActionResult } from "@/lib/action-result";
import { createSectorAction } from "@/app/(app)/admin/sectors/actions";

export function CreateSectorForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createSectorAction, null);
  const [name, setName] = useState("");
  const [slugEdited, setSlugEdited] = useState<string | null>(null);
  const slug = slugEdited ?? deriveSlug(name);
  return (
    <form action={action} className="card flex max-w-xl flex-col gap-4 p-6">
      <h2 className="h-section">New sector</h2>
      <div className="field">
        <label className="label" htmlFor="sector-name">
          Name
        </label>
        <input id="sector-name" name="name" required maxLength={128} value={name} onChange={(event) => setName(event.target.value)} className="input" />
      </div>
      <div className="field">
        <label className="label" htmlFor="sector-slug">
          Slug
        </label>
        <input
          id="sector-slug"
          name="slug"
          required
          pattern="[a-z0-9-]{2,64}"
          value={slug}
          onChange={(event) => setSlugEdited(event.target.value)}
          className="input mono"
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="sector-description">
          Description
        </label>
        <textarea id="sector-description" name="description" maxLength={512} rows={2} className="input" />
      </div>
      <fieldset className="field">
        <legend className="label">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(sectorColors).map(([token, hex], index) => (
            <label key={token} className="swatch-option">
              <input type="radio" name="color" value={token} defaultChecked={index === 0} className="sr-only" />
              <span aria-hidden className="swatch" style={{ backgroundColor: `var(--${token}, ${hex})` }} />
              <span className="sr-only">{token}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {state?.ok === false && (
        <p role="alert" className="err">
          {state.message}
        </p>
      )}
      {state?.ok === true && <p className="small" style={{ color: "var(--success)" }}>Sector created.</p>}
      <button type="submit" disabled={pending} className="btn btn-primary self-start">
        Create sector
      </button>
    </form>
  );
}
