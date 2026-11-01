// Import Third-party Dependencies
import type { Preferences } from "@jolly-pixel/preferences";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  VOXEL_MODEL_PREFERENCES,
  type VoxelModelPreferences
} from "../preferences.ts";

// CONSTANTS
const kFields = VOXEL_MODEL_PREFERENCES.fields;
export const LIGHTING_MODES = Object.freeze(
  kFields.lighting.options.map((option) => option.value)
);
export const KEY_LIGHT_PRESETS = Object.freeze(
  kFields.keyLight.options.map((option) => option.value)
);
const kLightingBackgrounds: Readonly<Record<LightingMode, string>> = {
  flat: "#262627",
  studio: "#262627",
  day: "#6f97c2",
  night: "#0c0e14"
};

export type LightingMode = VoxelModelPreferences["lighting"];
export type KeyLightPreset = VoxelModelPreferences["keyLight"];

export type ViewSettings = VoxelModelPreferences;

export const DEFAULT_VIEW_SETTINGS: ViewSettings =
  VOXEL_MODEL_PREFERENCES.defaults;

export function isLit(
  settings: Pick<ViewSettings, "lighting">
): boolean {
  return settings.lighting !== "flat";
}

export function resolveBackground(
  settings: Pick<ViewSettings, "lighting" | "background">
): string {
  return settings.background ?? kLightingBackgrounds[settings.lighting];
}

export type ViewSettingsEvents = {
  change: (settings: ViewSettings) => void;
};

export class ViewSettingsStore extends Emitter<ViewSettingsEvents> {
  #preferences: Preferences;
  #settings: ViewSettings;

  constructor(
    preferences: Preferences
  ) {
    super();
    this.#preferences = preferences;
    this.#settings = preferences.values(VOXEL_MODEL_PREFERENCES);
    preferences.watch(VOXEL_MODEL_PREFERENCES, (settings) => {
      if (JSON.stringify(settings) !== JSON.stringify(this.#settings)) {
        this.#settings = settings;
        this.emit("change", settings);
      }
    });
  }

  get settings(): ViewSettings {
    return this.#settings;
  }

  follow(
    apply: (settings: ViewSettings) => void
  ): () => void {
    apply(this.settings);

    return this.subscribe("change", apply);
  }

  update(
    patch: Partial<ViewSettings>
  ): void {
    this.#preferences.update(VOXEL_MODEL_PREFERENCES, patch);
  }
}
