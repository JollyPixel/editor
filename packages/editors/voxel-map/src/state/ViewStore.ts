// Import Third-party Dependencies
import type { Preferences } from "@jolly-pixel/editor.host/preferences";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  ViewSettings,
  type ViewSettingsJSON
} from "./ViewSettings.ts";
import { VOXEL_MAP_PREFERENCES } from "../preferences.ts";

export type ViewStoreEvents = {
  change: (settings: ViewSettings) => void;
};

export class ViewStore extends Emitter<ViewStoreEvents> {
  #preferences: Preferences;
  #settings: ViewSettings;

  constructor(
    preferences: Preferences
  ) {
    super();

    this.#preferences = preferences;
    this.#settings = new ViewSettings(
      preferences.values(VOXEL_MAP_PREFERENCES)
    );
    preferences.watch(VOXEL_MAP_PREFERENCES, (values) => {
      const next = new ViewSettings(values);
      if (!next.equals(this.#settings)) {
        this.#settings = next;
        this.emit("change", next);
      }
    });
  }

  get settings(): ViewSettings {
    return this.#settings;
  }

  update(
    patch: Partial<ViewSettingsJSON>
  ): void {
    this.#preferences.update(VOXEL_MAP_PREFERENCES, patch);
  }
}
