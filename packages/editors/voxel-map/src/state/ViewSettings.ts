// Import Third-party Dependencies
import type { VoxelInspectorMode } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  VOXEL_MAP_PREFERENCES,
  type VoxelMapPreferences
} from "../preferences.ts";

export type LightingMode = VoxelMapPreferences["lighting"];
export type InspectorMode = VoxelMapPreferences["inspector"];

export const INSPECTOR_MODES = Object.freeze(
  VOXEL_MAP_PREFERENCES.fields.inspector.options.map(
    (option) => option.value
  ) satisfies readonly VoxelInspectorMode[]
);

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
  static readonly DEFAULT = new ViewSettings(VOXEL_MAP_PREFERENCES.defaults);

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
}
