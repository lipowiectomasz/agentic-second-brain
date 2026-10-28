import type { DocumentStatus } from "@cortex/core/document-status";
import type { IconName } from "@/components/ui/icon";
import { Icon } from "@/components/ui/icon";
import { isSealed } from "@/lib/document-status";

const statuses: Record<DocumentStatus, { label: string; tone: string; icon: IconName }> = {
  draft: { label: "Draft", tone: "st-draft", icon: "pencil" },
  approved: { label: "Approved", tone: "st-approved", icon: "check" },
  in_progress: { label: "In progress", tone: "st-progress", icon: "progress" },
  implemented: { label: "Implemented", tone: "st-implemented", icon: "implemented" },
  superseded: { label: "Superseded", tone: "st-superseded", icon: "superseded" },
  deprecated: { label: "Deprecated", tone: "st-deprecated", icon: "deprecated" },
};

export function DocumentStatusBadge({ status, sealed = true }: { status: DocumentStatus; sealed?: boolean }) {
  const badge = statuses[status];
  return (
    <>
      <span className={`badge badge-doc ${badge.tone}`}>
        <Icon name={badge.icon} size={11} strokeWidth={1.7} />
        {badge.label}
      </span>
      {sealed && isSealed(status) && (
        <span className="seal" aria-label="Sealed, cannot be edited" title="Sealed - this document can't be edited. Corrections become a new document that supersedes it.">
          <Icon name="lock" size={11} strokeWidth={1.7} />
          Sealed
        </span>
      )}
    </>
  );
}
