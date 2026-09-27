// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  MemoryStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";

// CONSTANTS
const kStorageKey = "voxel-model:view";
export const SHADING_MODES = ["lit", "flat"] as const;
export const KEY_LIGHT_PRESETS = ["front-left", "front-right", "top"] as const;
export const ENVIRONMENT_INTENSITY_RANGE = { min: 0, max: 2 } as const;
export const EXPOSURE_RANGE = { min: 0.25, max: 3 } as const;
export const GLOW_STRENGTH_RANGE = { min: 0, max: 3 } as const;

export type ShadingMode = typeof SHADING_MODES[number];
export type KeyLightPreset = typeof KEY_LIGHT_PRESETS[number];

export interface ViewSettings {
  shading: ShadingMode;
  environment: boolean;
  environmentIntensity: number;
  keyLight: KeyLightPreset;
  exposure: number;
  glow: boolean;
  glowStrength: number;
}

type ViewSettingRule<T> = (value: unknown) => T;

type ViewSettingRules = {
  readonly [TKey in keyof ViewSettings]: ViewSettingRule<ViewSettings[TKey]>;
};

const kRules: ViewSettingRules = {
  shading: choice(SHADING_MODES, "lit"),
  environment: toggle(true),
  environmentIntensity: range(ENVIRONMENT_INTENSITY_RANGE, 0.5),
  keyLight: choice(KEY_LIGHT_PRESETS, "front-right"),
  exposure: range(EXPOSURE_RANGE, 1),
  glow: toggle(true),
  glowStrength: range(GLOW_STRENGTH_RANGE, 1)
};

export const DEFAULT_VIEW_SETTINGS: Readonly<ViewSettings> = Object.freeze(normalize({}));

export type ViewSettingsEvents = {
  change: (settings: ViewSettings) => void;
};

export interface ViewSettingsStoreOptions {
  storage?: StorageAdapter;
}

export class ViewSettingsStore extends Emitter<ViewSettingsEvents> {
  #storage: StorageAdapter;
  #settings: ViewSettings;

  constructor(
    options: ViewSettingsStoreOptions = {}
  ) {
    super();
    this.#storage = options.storage ?? new MemoryStorageAdapter();
    this.#settings = normalize(parse(this.#storage.get(kStorageKey)));
  }

  get settings(): ViewSettings {
    return { ...this.#settings };
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
    const next = normalize({
      ...this.#settings,
      ...patch
    });
    const json = JSON.stringify(next);
    if (json === JSON.stringify(this.#settings)) {
      return;
    }

    this.#settings = next;
    this.#storage.set(kStorageKey, json);
    this.emit("change", this.settings);
  }
}

function parse(
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

function normalize(
  value: unknown
): ViewSettings {
  const source = typeof value === "object" && value !== null ? value : {};
  function read<TKey extends keyof ViewSettings>(
    key: TKey
  ): ViewSettings[TKey] {
    return kRules[key](Reflect.get(source, key));
  }

  return {
    shading: read("shading"),
    environment: read("environment"),
    environmentIntensity: read("environmentIntensity"),
    keyLight: read("keyLight"),
    exposure: read("exposure"),
    glow: read("glow"),
    glowStrength: read("glowStrength")
  };
}

function toggle(
  fallback: boolean
): ViewSettingRule<boolean> {
  return (value) => (typeof value === "boolean" ? value : fallback);
}

function choice<T extends string>(
  values: readonly T[],
  fallback: T
): ViewSettingRule<T> {
  return (value) => values.find((candidate) => candidate === value) ?? fallback;
}

function range(
  bounds: { min: number; max: number; },
  fallback: number
): ViewSettingRule<number> {
  return (value) => (typeof value === "number" && Number.isFinite(value) ?
    Math.min(Math.max(value, bounds.min), bounds.max) :
    fallback);
}
