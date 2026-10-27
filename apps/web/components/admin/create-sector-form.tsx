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
    <form action={action} className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="font-semibold">New sector</h2>
      <label className="flex flex-col gap-1">
        Name
        <input name="name" required maxLength={128} value={name} onChange={(event) => setName(event.target.value)} className="rounded border px-3 py-2" />
      </label>
      <label className="flex flex-col gap-1">
        Slug
        <input
          name="slug"
          required
          pattern="[a-z0-9-]{2,64}"
          value={slug}
          onChange={(event) => setSlugEdited(event.target.value)}
          className="rounded border px-3 py-2 font-mono"
        />
      </label>
      <label className="flex flex-col gap-1">
        Description
        <textarea name="description" maxLength={512} rows={2} className="rounded border px-3 py-2" />
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend>Colour</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(sectorColors).map(([token, hex], index) => (
            <label key={token} className="flex items-center gap-1 text-sm">
              <input type="radio" name="color" value={token} defaultChecked={index === 0} />
              <span aria-hidden className="inline-block size-4 rounded-full" style={{ backgroundColor: hex }} />
              <span className="sr-only">{token}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {state?.ok === false && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      )}
      {state?.ok === true && <p className="text-sm">Sector created.</p>}
      <button type="submit" disabled={pending} className="w-fit rounded bg-black px-4 py-2 text-white disabled:opacity-60">
        Create sector
      </button>
    </form>
  );
}
