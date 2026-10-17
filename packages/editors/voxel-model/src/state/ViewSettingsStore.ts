// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  MemoryStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";

// CONSTANTS
const kStorageKey = "voxel-model:view";
export const LIGHTING_MODES = ["flat", "studio", "day", "night"] as const;
export const KEY_LIGHT_PRESETS = ["front-left", "front-right", "top"] as const;
const kHexColor = /^#[\da-f]{6}$/i;
const kLightingBackgrounds: Readonly<Record<LightingMode, string>> = {
  flat: "#262627",
  studio: "#262627",
  day: "#6f97c2",
  night: "#0c0e14"
};

export type LightingMode = typeof LIGHTING_MODES[number];
export type KeyLightPreset = typeof KEY_LIGHT_PRESETS[number];

export interface ViewSettings {
  lighting: LightingMode;
  background: string | null;
  keyLight: KeyLightPreset;
  reflections: boolean;
  shadows: boolean;
  glow: boolean;
}

type ViewSettingRule<T> = (value: unknown) => T;

type ViewSettingRules = {
  readonly [TKey in keyof ViewSettings]: ViewSettingRule<ViewSettings[TKey]>;
};

const kRules: ViewSettingRules = {
  lighting: choice(LIGHTING_MODES, "studio"),
  background: hexColorOrNull,
  keyLight: choice(KEY_LIGHT_PRESETS, "front-right"),
  reflections: toggle(true),
  shadows: toggle(false),
  glow: toggle(true)
};

export const DEFAULT_VIEW_SETTINGS: Readonly<ViewSettings> = Object.freeze(normalize({}));

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
    lighting: read("lighting"),
    background: read("background"),
    keyLight: read("keyLight"),
    reflections: read("reflections"),
    shadows: read("shadows"),
    glow: read("glow")
  };
}

function toggle(
  fallback: boolean
): ViewSettingRule<boolean> {
  return (value) => (typeof value === "boolean" ? value : fallback);
}

function hexColorOrNull(
  value: unknown
): string | null {
  return typeof value === "string" && kHexColor.test(value) ? value.toLowerCase() : null;
}

function choice<T extends string>(
  values: readonly T[],
  fallback: T
): ViewSettingRule<T> {
  return (value) => values.find((candidate) => candidate === value) ?? fallback;
}
