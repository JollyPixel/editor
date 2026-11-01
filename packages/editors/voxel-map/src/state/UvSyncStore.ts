// Import Third-party Dependencies
import type { Preferences } from "@jolly-pixel/preferences";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  VOXEL_MAP_PREFERENCES,
  type VoxelMapPreferences
} from "../preferences.ts";

export type UvSyncMode = VoxelMapPreferences["uvSync"];

export const UV_SYNC_MODES: readonly UvSyncMode[] = Object.freeze(
  VOXEL_MAP_PREFERENCES.fields.uvSync.options.map((option) => option.value)
);

export type UvSyncStoreEvents = {
  change: (value: UvSyncMode) => void;
};

export class UvSyncStore extends Emitter<UvSyncStoreEvents> {
  readonly values = UV_SYNC_MODES;

  #preferences: Preferences;
  #value: UvSyncMode;

  constructor(
    preferences: Preferences
  ) {
    super();

    this.#preferences = preferences;
    this.#value = preferences.values(VOXEL_MAP_PREFERENCES).uvSync;
    preferences.watch(VOXEL_MAP_PREFERENCES, ({ uvSync }) => {
      if (uvSync !== this.#value) {
        this.#value = uvSync;
        this.emit("change", uvSync);
      }
    });
  }

  get value(): UvSyncMode {
    return this.#value;
  }

  set value(
    value: UvSyncMode
  ) {
    this.#preferences.assign(VOXEL_MAP_PREFERENCES, "uvSync", value);
  }
}
