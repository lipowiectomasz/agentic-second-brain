export const fileKinds = ["standard", "procedure", "spec", "finding", "backlog", "memory", "module", "note"] as const;

export type FileKind = (typeof fileKinds)[number];

export type KindClass = "spine" | "immutable" | "write-once" | "personal" | "living";

export const kindClass: Record<FileKind, KindClass> = {
  standard: "spine",
  procedure: "spine",
  spec: "immutable",
  backlog: "immutable",
  finding: "write-once",
  memory: "personal",
  module: "living",
  note: "living",
};

export const documentKinds = ["spec", "backlog", "finding"] as const;

export type DocumentKind = (typeof documentKinds)[number];

export const docIdPrefix: Record<DocumentKind, "SPEC" | "TASK" | "FINDING"> = { spec: "SPEC", backlog: "TASK", finding: "FINDING" };
