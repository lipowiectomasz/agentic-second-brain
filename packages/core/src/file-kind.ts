export const fileKinds = ["standard", "procedure", "spec", "finding", "backlog", "memory", "module", "note"] as const;

export type FileKind = (typeof fileKinds)[number];
