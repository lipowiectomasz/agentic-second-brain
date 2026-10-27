export { recordAudit } from "./audit";
export {
  AlreadyMemberError,
  ForbiddenError,
  LastAdminError,
  RequestAlreadyDecidedError,
  RequestPendingError,
  SectorNotFoundError,
  SlugTakenError,
  UserNotFoundError,
} from "./errors";
export { buildMatrix, getAccessMatrix, testIdentityPrefix } from "./matrix";
export { decideRequest, listPendingRequests, requestAccess } from "./requests";
export { getSectorRole, setOrgAdmin, setRole } from "./roles";
export { canDecideRequest, canWriteSector, decideRoleChange, deriveSlug } from "./rules";
export { getSectorRow, listSectorRows } from "./sector-rows";
export { createSector, listMySectors, listSectorSummaries, listSectorsForCaller } from "./sectors";
export { accessRequestInputSchema, requestDecisionSchema, roleChangeSchema, sectorInputSchema } from "./types";
export type {
  AccessDeps,
  AccessMatrix,
  AccessRequestInput,
  MatrixRow,
  PendingRequest,
  RequestDecision,
  RoleChange,
  SectorInput,
  SectorRow,
  SectorSummary,
  SectorView,
} from "./types";
