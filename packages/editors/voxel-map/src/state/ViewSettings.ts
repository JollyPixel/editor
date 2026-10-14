// Import Third-party Dependencies
import type { VoxelInspectorMode } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { StoredFields } from "./StoredFields.ts";

// CONSTANTS
const kLightingModes = ["flat", "studio", "day", "night"] as const;

export const INSPECTOR_MODES = Object.freeze([
  "off",
  "overlay",
  "wireframe"
] as const satisfies readonly VoxelInspectorMode[]);

export type LightingMode = typeof kLightingModes[number];
export type InspectorMode = typeof INSPECTOR_MODES[number];

export interface ViewSettingsJSON {
  lighting: LightingMode;
  reflections: boolean;
  ambientOcclusion: boolean;
  shadows: boolean;
  blockLight: boolean;
  glow: boolean;
  grid: boolean;
  inspector: InspectorMode;
  chunkBounds: boolean;
}

export class ViewSettings implements ViewSettingsJSON {
  static readonly DEFAULT = new ViewSettings({
    lighting: "studio",
    reflections: false,
    ambientOcclusion: false,
    shadows: false,
    blockLight: true,
    glow: true,
    grid: true,
    inspector: "off",
    chunkBounds: false
  });

  static parse(
    raw: string | null
  ): ViewSettings {
    if (raw === null) {
      return ViewSettings.DEFAULT;
    }

    try {
      return ViewSettings.DEFAULT.#merged(
        JSON.parse(raw)
      );
    }
    catch {
      return ViewSettings.DEFAULT;
    }
  }

  readonly lighting: LightingMode;
  readonly reflections: boolean;
  readonly ambientOcclusion: boolean;
  readonly shadows: boolean;
  readonly blockLight: boolean;
  readonly glow: boolean;
  readonly grid: boolean;
  readonly inspector: InspectorMode;
  readonly chunkBounds: boolean;

  constructor(
    settings: ViewSettingsJSON
  ) {
    this.lighting = settings.lighting;
    this.reflections = settings.reflections;
    this.ambientOcclusion = settings.ambientOcclusion;
    this.shadows = settings.shadows;
    this.blockLight = settings.blockLight;
    this.glow = settings.glow;
    this.grid = settings.grid;
    this.inspector = settings.inspector;
    this.chunkBounds = settings.chunkBounds;

    Object.freeze(this);
  }

  with(
    patch: Partial<ViewSettingsJSON>
  ): ViewSettings {
    return this.#merged(patch);
  }

  equals(
    other: ViewSettings
  ): boolean {
    return this.lighting === other.lighting &&
      this.reflections === other.reflections &&
      this.ambientOcclusion === other.ambientOcclusion &&
      this.shadows === other.shadows &&
      this.blockLight === other.blockLight &&
      this.glow === other.glow &&
      this.grid === other.grid &&
      this.inspector === other.inspector &&
      this.chunkBounds === other.chunkBounds;
  }

  toJSON(): ViewSettingsJSON {
    return {
      lighting: this.lighting,
      reflections: this.reflections,
      ambientOcclusion: this.ambientOcclusion,
      shadows: this.shadows,
      blockLight: this.blockLight,
      glow: this.glow,
      grid: this.grid,
      inspector: this.inspector,
      chunkBounds: this.chunkBounds
    };
  }

  #merged(
    value: unknown
  ): ViewSettings {
    const fields = new StoredFields(value);

    return new ViewSettings({
      lighting: fields.oneOf("lighting", kLightingModes, this.lighting),
      inspector: fields.oneOf("inspector", INSPECTOR_MODES, this.inspector),
      grid: fields.boolean("grid", this.grid),
      chunkBounds: fields.boolean("chunkBounds", this.chunkBounds),
      reflections: fields.boolean("reflections", this.reflections),
      ambientOcclusion: fields.boolean(
        "ambientOcclusion",
        this.ambientOcclusion
      ),
      shadows: fields.boolean("shadows", this.shadows),
      blockLight: fields.boolean("blockLight", this.blockLight),
      glow: fields.boolean("glow", this.glow)
    });
  }
}
