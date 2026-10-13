// Import Third-party Dependencies
import {
  MemoryStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";

// CONSTANTS
const kStorageKey = "voxel-map:uv-sync";

export const UV_SYNC_MODES = Object.freeze([
  "live",
  "commit"
] as const);

export type UvSyncMode = typeof UV_SYNC_MODES[number];

export class UvSyncStore {
  static parse(
    raw: string | null
  ): UvSyncMode {
    return UV_SYNC_MODES.find((mode) => mode === raw) ?? "commit";
  }

  #storage: StorageAdapter;
  #mode: UvSyncMode;

  constructor(
    storage: StorageAdapter = new MemoryStorageAdapter()
  ) {
    this.#storage = storage;
    this.#mode = UvSyncStore.parse(storage.get(kStorageKey));
  }

  get mode(): UvSyncMode {
    return this.#mode;
  }

  set mode(
    mode: UvSyncMode
  ) {
    this.#mode = mode;
    this.#storage.set(kStorageKey, mode);
  }
}
