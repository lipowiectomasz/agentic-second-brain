import { LogoMark } from "@/components/brand/logo-mark";
import { Wordmark } from "@/components/brand/wordmark";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-wrap">
      <aside className="dot-grid hide-sm relative flex min-h-screen flex-[1_1_560px] flex-col justify-between overflow-hidden border-r border-border px-14 py-12" aria-hidden>
        <p className="folio">Field notebook</p>
        <div className="self-center opacity-90">
          <LogoMark size={180} />
        </div>
        <div className="flex max-w-xl flex-col gap-3.5">
          <p className="serif" style={{ fontSize: 44, lineHeight: "50px", letterSpacing: "-0.02em" }}>
            Your team&apos;s knowledge, <span className="italic">mapped by meaning.</span>
          </p>
          <p className="folio">Fig. 1 - a finding in one project, linked to a spec in another.</p>
        </div>
      </aside>
      <main className="flex min-h-screen flex-[1_1_420px] items-center justify-center px-4 py-10">
        <div className="card flex w-full max-w-[420px] flex-col gap-5 px-8 py-9" style={{ boxShadow: "var(--shadow-md)" }}>
          <Wordmark size={26} />
          {children}
        </div>
      </main>
    </div>
  );
}
