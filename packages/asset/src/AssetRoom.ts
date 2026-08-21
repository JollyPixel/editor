export interface AssetRoomName {
  readonly kind: string;
  readonly assetId: string;
}

/**
 * Shared browser and server room name, `${kind}:${assetId}`.
 */
export function assetRoomName(
  kind: string,
  assetId: string
): string {
  return `${kind}:${assetId}`;
}

/**
 * Parses `${kind}:${assetId}` at the first colon.
 * Returns `null` if either part or the separator is missing.
 */
export function parseAssetRoomName(
  roomName: string
): AssetRoomName | null {
  const separator = roomName.indexOf(":");
  if (
    separator <= 0 ||
    separator === roomName.length - 1
  ) {
    return null;
  }

  return {
    kind: roomName.slice(0, separator),
    assetId: roomName.slice(separator + 1)
  };
}
