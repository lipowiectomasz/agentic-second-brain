import Link from "next/link";

export default function FileNotFound() {
  return (
    <main className="page max-w-2xl">
      <p className="folio">404</p>
      <h1 className="h-display">File not found</h1>
      <hr className="rule-double" />
      <p className="small muted">This file does not exist or you do not have access.</p>
      <p>
        <Link href="/" className="btn btn-secondary">
          Back to the map
        </Link>
      </p>
    </main>
  );
}
