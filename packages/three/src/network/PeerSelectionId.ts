export type PeerSelectionId = string | null;

/**
 * Decodes a presence value published by `PeerSelectionSync` into a selection
 * id: `null` for "this peer has nothing selected" (still a known, valid
 * state, unlike `PeerFrustumPose`'s malformed-value case), a string for the
 * object it has selected, or `undefined` for a missing/malformed value -
 * left alone rather than treated as `null`, so a stray non-string presence
 * value some other consumer wrote under the same key does not silently clear
 * an existing peer selection.
 */
export function decodePeerSelectionId(
  value: unknown
): PeerSelectionId | undefined {
  if (value === null || typeof value === "string") {
    return value;
  }

  return undefined;
}
