const slugPattern = /^[a-z0-9-]{1,64}$/;

export const spineSectorId = "spine";

export function sectorTeamId(slug: string): string {
  if (!slugPattern.test(slug)) {
    throw new Error(`Invalid sector slug: ${slug}`);
  }
  return `sector-${slug}`;
}
