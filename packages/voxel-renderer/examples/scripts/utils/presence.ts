// Import Internal Dependencies
import type { VoxelCoord } from "../../../src/world/types.ts";

// CONSTANTS
const kUsernameStorageKey = "voxel-flat-world:username";
/** One color per peer, picked deterministically so every tab agrees. */
const kPeerColors = [
  "#f94144",
  "#f3722c",
  "#f9c74f",
  "#90be6d",
  "#43aa8b",
  "#4d908e",
  "#577590",
  "#277da1"
];

/**
 * Prompts once per browser session, then reuses the answer — opening a second
 * tab asks again, which is what makes the demo testable alone.
 */
export function resolveUsername(): string {
  const cached = sessionStorage.getItem(kUsernameStorageKey);
  if (cached) {
    return cached;
  }

  // eslint-disable-next-line no-alert -- example-only UX, no dedicated UI needed here
  const entered = window.prompt("Choose a username for this session")?.trim();
  const username = entered && entered.length > 0 ?
    entered :
    "Guest";

  sessionStorage.setItem(kUsernameStorageKey, username);

  return username;
}

export function peerColor(
  clientId: string
): string {
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    hash = ((hash * 31) + clientId.charCodeAt(i)) | 0;
  }

  return kPeerColors[Math.abs(hash) % kPeerColors.length];
}

/**
 * Presence payloads come off the wire untyped: anything that isn't a coordinate
 * is read as "this peer has no brush".
 */
export function readBrushCoord(
  value: unknown
): VoxelCoord | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const { x, y, z } = value as Partial<VoxelCoord>;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof z !== "number"
  ) {
    return null;
  }

  return { x, y, z };
}

export function coordEqual(
  a: VoxelCoord | null,
  b: VoxelCoord | null
): boolean {
  if (a === null || b === null) {
    return a === b;
  }

  return a.x === b.x && a.y === b.y && a.z === b.z;
}

export function readUsername(
  identity: Record<string, unknown>
): string {
  return typeof identity.username === "string" ? identity.username : "Guest";
}
