// Import Third-party Dependencies
import { AssetType } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type { ColorJSON } from "../scene/file/SceneFile.ts";

export type EnvironmentSkyFile =
  | { kind: "none"; }
  | { kind: "color"; color: ColorJSON; }
  | { kind: "day"; }
  | { kind: "night"; };

export interface EnvironmentSunFile {
  color: ColorJSON;
  intensity: number;
  /**
   * Degrees around the up axis, from +Z toward +X.
   */
  azimuth: number;
  /**
   * Degrees above the horizon.
   */
  elevation: number;
}

export interface EnvironmentAmbientFile {
  skyColor: ColorJSON;
  groundColor: ColorJSON;
  intensity: number;
}

export type EnvironmentReflectionsKind = "none" | "room";

export interface EnvironmentReflectionsFile {
  kind: EnvironmentReflectionsKind;
  intensity: number;
}

export type EnvironmentFogFile =
  | { kind: "none"; }
  | { kind: "linear"; color: ColorJSON; near: number; far: number; }
  | { kind: "exp2"; color: ColorJSON; density: number; };

export type EnvironmentToneMappingKind = "none" | "neutral" | "aces" | "agx";

export interface EnvironmentToneMappingFile {
  kind: EnvironmentToneMappingKind;
  exposure: number;
}

export interface EnvironmentGlowFile {
  strength: number;
  /**
   * From 0 to 1.
   */
  radius: number;
}

export type EnvironmentLightFalloff = "wide" | "focused";

export interface EnvironmentVoxelFile {
  blockLightFalloff: EnvironmentLightFalloff;
  /**
   * How much block light brightens shadowed faces, from 0.
   */
  shadowFill: number;
}

export interface EnvironmentFile {
  version: 1;
  sky: EnvironmentSkyFile;
  /**
   * `null` draws no sun.
   */
  sun: EnvironmentSunFile | null;
  ambient: EnvironmentAmbientFile;
  reflections: EnvironmentReflectionsFile;
  fog: EnvironmentFogFile;
  toneMapping: EnvironmentToneMappingFile;
  /**
   * Blooms emissive surfaces. `null` draws no bloom.
   */
  glow: EnvironmentGlowFile | null;
  voxel: EnvironmentVoxelFile;
}

export const ENVIRONMENT_ASSET = new AssetType<EnvironmentFile>("environment");
