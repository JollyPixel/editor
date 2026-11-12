// Import Third-party Dependencies
import {
  parsePeerFieldLock,
  type PeerMetadata
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  modelValueKey,
  type ModelValueRef
} from "./VoxelModelCommandKeys.ts";
import type { MaterialSurfaceJSON } from "./types.ts";

// CONSTANTS
export const VOXEL_MODEL_PRESENCE_KEYS = {
  animateCursor: "animateCursor",
  block: "block",
  blockHover: "blockHover",
  materialEdit: "materialEdit",
  materialLive: "materialLive",
  transformLive: "transformLive",
  transformLock: "transformLock"
} as const;

export type MaterialLockField = keyof MaterialSurfaceJSON | "name";

export function materialFieldLockPath(
  materialId: string,
  field: MaterialLockField
): string {
  return modelValueKey(field === "name" ?
    { kind: "material-name", id: materialId } :
    { kind: "material-surface", id: materialId, field });
}

export function holdsModelLock(
  presence: PeerMetadata,
  ref: ModelValueRef
): boolean {
  switch (ref.kind) {
    case "transform":
      return presence[VOXEL_MODEL_PRESENCE_KEYS.transformLock] === ref.id;
    case "material-name":
    case "material-surface":
      return parsePeerFieldLock(presence) === modelValueKey(ref);
    default:
      return false;
  }
}
