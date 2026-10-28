import type { ReactNode } from "react";
import { Icon } from "./icon";

export type BannerTone = "info" | "warning" | "success" | "danger";

const icons: Record<BannerTone, "info" | "warning" | "check" | "danger"> = { info: "info", warning: "warning", success: "check", danger: "danger" };

export function Banner({ tone, children, action, onDismiss }: { tone: BannerTone; children: ReactNode; action?: ReactNode; onDismiss?: () => void }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`banner banner-${tone}`}>
      <Icon name={icons[tone]} strokeWidth={tone === "success" ? 2 : 1.6} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
      {action !== undefined && <div className="flex-none">{action}</div>}
      {onDismiss !== undefined && (
        <button type="button" className="btn btn-ghost btn-sm btn-icon -my-1 flex-none" aria-label="Dismiss" onClick={onDismiss}>
          <Icon name="cross" size={14} />
        </button>
      )}
    </div>
  );
}
