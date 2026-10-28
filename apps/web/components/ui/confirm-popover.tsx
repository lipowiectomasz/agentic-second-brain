import type { ReactNode } from "react";

export function ConfirmPopover({ id, triggerLabel, title, description, confirm }: { id: string; triggerLabel: string; title: string; description: string; confirm: ReactNode }) {
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" popoverTarget={id}>
        {triggerLabel}
      </button>
      <div id={id} popover="auto" role="dialog" aria-labelledby={`${id}-title`} className="popover m-auto">
        <p id={`${id}-title`} className="font-medium">
          {title}
        </p>
        <p className="small muted">{description}</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-sm" popoverTarget={id} popoverTargetAction="hide">
            Cancel
          </button>
          {confirm}
        </div>
      </div>
    </>
  );
}
