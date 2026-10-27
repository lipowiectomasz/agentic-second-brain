import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Administration</h1>
      <ul className="flex flex-col gap-2">
        <li>
          <Link href="/admin/sectors" className="underline">
            Sectors
          </Link>
        </li>
        <li>
          <Link href="/admin/access" className="underline">
            Access
          </Link>
        </li>
      </ul>
    </main>
  );
}
