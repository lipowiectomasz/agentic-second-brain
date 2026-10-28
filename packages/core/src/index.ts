export { docIdPrefix, documentKinds, fileKinds, kindClass } from "./file-kind";
export type { DocumentKind, FileKind, KindClass } from "./file-kind";
export { sectorKinds, sectorRoles } from "./sector-role";
export type { SectorKind, SectorRole } from "./sector-role";
export { sectorTeamId, spineSectorId } from "./team-id";
export { adminLabel, sectorReadPermissions, sectorWritePermissions } from "./permissions";
export type { SectorAccessScope } from "./permissions";
export { sectorColorHex, sectorColorToken, sectorColorTokens, sectorColorVar, sectorColors } from "./sector-colors";
export type { SectorColorToken } from "./sector-colors";
export { auditActions } from "./audit-action";
export type { AuditAction, AuditEvent } from "./audit-action";
export { deriveSlug } from "./slug";
export { chunkStatuses, documentStatuses, hiddenByDefault } from "./document-status";
export type { ChunkStatus, DocumentStatus } from "./document-status";
export { chunkMetadataSchema, embeddingDimension, maxChunksPerFile, maxFileBytes } from "./chunks";
export type { ChunkMetadata } from "./chunks";
export {
  bodyHash,
  joinFrontmatter,
  managedFrontmatterKeys,
  normalizeLineEndings,
  sha256Hex,
  splitFrontmatter,
  stripManagedFrontmatter,
  stripManagedLines,
} from "./body-hash";
export type { FrontmatterSplit, ManagedFrontmatterKey } from "./body-hash";
export { maskSecret, scanForSecrets, shannonEntropy } from "./secrets";
export type { SecretFinding, SecretRuleId } from "./secrets";
export { validateSyncPath } from "./sync-path";
export type { SyncPathProblem } from "./sync-path";
