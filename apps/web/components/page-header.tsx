import type { ReactNode } from "react";

export function PageHeader({ folio, title, children }: { folio: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="folio">{folio}</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="h-display">{title}</h1>
        {children}
      </div>
    </div>
  );
}
