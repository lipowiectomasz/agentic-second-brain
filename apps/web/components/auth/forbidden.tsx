import Link from "next/link";

export function Forbidden() {
  return (
    <section role="alert" className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-16">
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p>You need organisation admin rights to open this page.</p>
      <Link href="/" className="underline">
        Back to the map
      </Link>
    </section>
  );
}
