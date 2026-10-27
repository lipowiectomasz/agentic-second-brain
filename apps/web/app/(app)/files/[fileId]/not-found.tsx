import Link from "next/link";

export default function FileNotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-16">
      <h1 className="text-2xl font-semibold">File not found</h1>
      <p>This file does not exist or you do not have access.</p>
      <Link href="/" className="underline">
        Back to the map
      </Link>
    </main>
  );
}
