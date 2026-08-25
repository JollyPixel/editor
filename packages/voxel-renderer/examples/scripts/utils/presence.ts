// Import Third-party Dependencies
import { colorFromKey } from "@jolly-pixel/color";
import {
  LocalStorageAdapter,
  resolveStoredPrompt
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelCoord } from "../../../src/world/types.ts";

// CONSTANTS
const kUsernameStorageKey = "voxel-flat-world:username";
const kUsernameStorage = new LocalStorageAdapter({
  resolve: () => sessionStorage
});

/**
 * Prompts once per browser session, then reuses the answer. Opening a second
 * tab asks again, which is what makes the demo testable alone.
 */
export function resolveUsername(): Promise<string> {
  return resolveStoredPrompt({
    title: "Join flat world",
    label: "Username",
    confirmLabel: "Join",
    storage: kUsernameStorage,
    storageKey: kUsernameStorageKey,
    fallbackValue: "Guest"
  });
}

/**
 * Hashed from the username rather than the connection's clientId: the id a
 * transport mints is per-connection, so a peer reconnecting (or joining from
 * a second tab) would otherwise pick up a different color each time.
 */
export function peerColor(
  username: string
): string {
  return colorFromKey(username);
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
