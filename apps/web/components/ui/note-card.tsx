import type { ReactNode } from "react";

export function NoteCard({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <figure className="note-card m-0 flex flex-col gap-2">
      <figcaption className="folio">{heading}</figcaption>
      <blockquote>{children}</blockquote>
    </figure>
  );
}
