import Link from "next/link";

export function SupersededBanner({ docId, fileId }: { docId: string; fileId: string | null }) {
  return (
    <p role="note" className="small flex items-center gap-2 rounded-md border border-warning bg-[color-mix(in_oklab,var(--warning)_8%,var(--surface))] px-4 py-3">
      <span className="badge badge-warning flex-none">Superseded</span>
      <span>
        This document was superseded by{" "}
        {fileId === null ? (
          <span className="mono">{docId}</span>
        ) : (
          <Link href={`/files/${fileId}`} className="mono text-accent underline underline-offset-2">
            {docId}
          </Link>
        )}
        .
      </span>
    </p>
  );
}
