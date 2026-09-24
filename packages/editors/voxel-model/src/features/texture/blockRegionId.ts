// CONSTANTS
const kBlockRegionPrefix = "block-";

export function blockRegionId(
  uuid: string
): string {
  return `${kBlockRegionPrefix}${uuid}`;
}

export function blockUuidFromRegion(
  id: string
): string | null {
  return id.startsWith(kBlockRegionPrefix)
    ? id.slice(kBlockRegionPrefix.length)
    : null;
}
