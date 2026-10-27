export { ForbiddenError } from "@cortex/server-kit";

function named<T extends Error>(error: T, name: string): T {
  error.name = name;
  return error;
}

export class SectorNotFoundError extends Error {
  constructor(sectorId: string) {
    super(`Sector ${sectorId} not found`);
    named(this, "SectorNotFoundError");
  }
}

export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`Slug ${slug} is already taken`);
    named(this, "SlugTakenError");
  }
}

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User ${userId} not found`);
    named(this, "UserNotFoundError");
  }
}

export class LastAdminError extends Error {
  constructor() {
    super("At least one organisation admin must remain");
    named(this, "LastAdminError");
  }
}

export class AlreadyMemberError extends Error {
  constructor() {
    super("Already a member of this sector");
    named(this, "AlreadyMemberError");
  }
}

export class RequestPendingError extends Error {
  constructor() {
    super("A request for this sector is already pending");
    named(this, "RequestPendingError");
  }
}

export class RequestAlreadyDecidedError extends Error {
  constructor() {
    super("This request has already been decided");
    named(this, "RequestAlreadyDecidedError");
  }
}
