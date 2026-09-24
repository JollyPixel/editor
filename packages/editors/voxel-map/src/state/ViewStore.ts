// Import Third-party Dependencies
import {
  MemoryStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";
import { Emitter } from "@openally/emitt";

// CONSTANTS
const kStorageKey = "voxel-map:view";
const kLightingModes = ["flat", "studio", "daylight"] as const;

export type LightingMode = typeof kLightingModes[number];

export interface ViewSettings {
  lighting: LightingMode;
  reflections: boolean;
  ambientOcclusion: boolean;
  shadows: boolean;
}

export const DEFAULT_VIEW_SETTINGS: Readonly<ViewSettings> = Object.freeze({
  lighting: "studio",
  reflections: false,
  ambientOcclusion: false,
  shadows: false
});

export type ViewStoreEvents = {
  change: (settings: Readonly<ViewSettings>) => void;
};

export class ViewStore extends Emitter<ViewStoreEvents> {
  #storage: StorageAdapter;
  #settings: Readonly<ViewSettings>;

  constructor(
    storage: StorageAdapter = new MemoryStorageAdapter()
  ) {
    super();
    this.#storage = storage;
    this.#settings = Object.freeze(
      settingsFrom(parseJson(storage.get(kStorageKey)))
    );
  }

  get settings(): Readonly<ViewSettings> {
    return this.#settings;
  }

  update(
    patch: Partial<ViewSettings>
  ): void {
    const next = settingsFrom(patch, this.#settings);
    if (sameSettings(next, this.#settings)) {
      return;
    }

    this.#settings = Object.freeze(next);
    this.#storage.set(kStorageKey, JSON.stringify(next));
    this.emit("change", this.#settings);
  }
}

function parseJson(
  raw: string | null
): unknown {
  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw);
  }
  catch {
    return null;
  }
}

function settingsFrom(
  value: unknown,
  fallback: Readonly<ViewSettings> = DEFAULT_VIEW_SETTINGS
): ViewSettings {
  const fields: Map<string, unknown> = typeof value === "object" &&
    value !== null ?
    new Map(Object.entries(value)) :
    new Map();
  const lighting = fields.get("lighting");

  return {
    lighting: kLightingModes.find((mode) => mode === lighting) ??
      fallback.lighting,
    reflections: booleanOr(
      fields.get("reflections"),
      fallback.reflections
    ),
    ambientOcclusion: booleanOr(
      fields.get("ambientOcclusion"),
      fallback.ambientOcclusion
    ),
    shadows: booleanOr(
      fields.get("shadows"),
      fallback.shadows
    )
  };
}

function booleanOr(
  value: unknown,
  fallback: boolean
): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function sameSettings(
  left: ViewSettings,
  right: ViewSettings
): boolean {
  return left.lighting === right.lighting &&
    left.reflections === right.reflections &&
    left.ambientOcclusion === right.ambientOcclusion &&
    left.shadows === right.shadows;
}
