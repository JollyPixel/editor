// Import Third-party Dependencies
import type { StorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { StoredChoice } from "./StoredChoice.ts";

export const UV_SYNC_MODES = Object.freeze([
  "live",
  "commit"
] as const);

export type UvSyncMode = typeof UV_SYNC_MODES[number];

export class UvSyncStore extends StoredChoice<UvSyncMode> {
  constructor(
    storage?: StorageAdapter
  ) {
    super({
      key: "voxel-map:uv-sync",
      values: UV_SYNC_MODES,
      fallback: "commit",
      storage
    });
  }
}
