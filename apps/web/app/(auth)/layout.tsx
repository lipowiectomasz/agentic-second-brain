export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border p-6">
        <h1 className="text-2xl font-semibold">Cortex</h1>
        {children}
      </div>
    </main>
  );
}
