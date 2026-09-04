export type PeerHoverId = string | null;

/**
 * Decodes a presence value published by `PeerHoverSync` into a hover id -
 * same shape and same rationale as `decodePeerSelectionId`: `null` for
 * "this peer isn't hovering anything" (a known, valid state), a string for
 * the object it's hovering, or `undefined` for a missing/malformed value -
 * left alone rather than treated as `null`, so a stray non-string presence
 * value some other consumer wrote under the same key does not silently
 * clear an existing peer hover.
 */
export function decodePeerHoverId(
  value: unknown
): PeerHoverId | undefined {
  if (value === null || typeof value === "string") {
    return value;
  }

  return undefined;
}
