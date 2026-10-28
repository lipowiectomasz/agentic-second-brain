import Link from "next/link";

export function DocId({ id, href }: { id: string; href?: string }) {
  if (href === undefined) return <span className="doc-id">{id}</span>;
  return (
    <Link href={href} className="doc-id text-foreground underline-offset-2 hover:underline">
      {id}
    </Link>
  );
}
