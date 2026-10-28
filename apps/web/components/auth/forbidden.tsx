import Link from "next/link";

export function Forbidden() {
  return (
    <main className="grid flex-1 place-items-center px-4 py-10">
      <div role="alert" className="flex max-w-md flex-col items-center gap-3 text-center">
        <p className="folio">403</p>
        <h1 className="serif" style={{ fontSize: 30, lineHeight: "36px" }}>
          Access denied
        </h1>
        <p className="muted">You need organisation admin rights to open this page.</p>
        <Link href="/" className="btn btn-secondary">
          Back to the map
        </Link>
      </div>
    </main>
  );
}
