import type { DocumentStatus } from "@cortex/core/document-status";

export function isSealed(status: DocumentStatus): boolean {
  return status !== "draft";
}

export function versionLine(version: number): string | null {
  if (version <= 1) return null;
  const earlier = version - 1;
  return `v${version} · ${earlier} earlier ${earlier === 1 ? "version" : "versions"}`;
}
