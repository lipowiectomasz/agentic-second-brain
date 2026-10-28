"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";

export function CopyPathButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm btn-icon"
      aria-label={copied ? "Path copied" : "Copy path"}
      title={copied ? "Copied" : "Copy path"}
      onClick={() => {
        void navigator.clipboard.writeText(path).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={14} />
    </button>
  );
}
