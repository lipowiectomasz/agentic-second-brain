export function FormAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded px-3.5 py-3 text-sm"
      style={{ background: "color-mix(in oklab, var(--danger) 8%, var(--surface))", border: "1px solid color-mix(in oklab, var(--danger) 35%, transparent)" }}
    >
      <span aria-hidden style={{ color: "var(--danger)" }}>!</span>
      <span>{message}</span>
    </div>
  );
}
