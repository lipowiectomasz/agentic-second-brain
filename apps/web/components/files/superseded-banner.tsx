import Link from "next/link";

export function SupersededBanner({ docId, fileId }: { docId: string; fileId: string | null }) {
  return (
    <p role="note" className="rounded border border-amber-700 px-3 py-2 text-sm">
      This document was superseded by {fileId === null ? docId : <Link href={`/files/${fileId}`} className="underline">{docId}</Link>}.
    </p>
  );
}
