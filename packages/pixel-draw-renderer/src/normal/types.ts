// Import Internal Dependencies
import type { UVGeometry } from "../uv/geometry/types.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";
import type { IslandMap } from "./IslandMap.ts";
import type { NormalMapConfig } from "./NormalMapConfig.ts";

// CONSTANTS
export const NORMAL_MAP_HEIGHTS = [
  "luminance",
  "regions",
  "flat"
] as const;
export const NORMAL_MAP_BORDERS = [
  "wrap",
  "clamp",
  "bevel"
] as const;
export const NORMAL_MAP_BEVEL_PROFILES = [
  "linear",
  "round"
] as const;

export type NormalMapHeight = typeof NORMAL_MAP_HEIGHTS[number];
export type NormalMapBorder = typeof NORMAL_MAP_BORDERS[number];
export type NormalMapBevelProfile = typeof NORMAL_MAP_BEVEL_PROFILES[number];

export interface NormalMapBevel {
  width: number;
  profile: NormalMapBevelProfile;
}

export interface NormalMapSettings {
  height: NormalMapHeight;
  invert: boolean;
  strength: number;
  border: NormalMapBorder;
  bevel: NormalMapBevel;
  edgeIntensity: number;
  levels: number;
}

export interface NormalMapZone {
  regionId: string;
  settings: Partial<NormalMapSettings> | "off";
}

export interface NormalMapData {
  defaults: NormalMapSettings;
  zones: NormalMapZone[];
}

export interface IndexedNormalMapZone {
  zone: NormalMapZone;
  index: number;
}

export type ResolvedNormalMapSettings = Readonly<NormalMapSettings> | "off";

export interface IslandFace {
  regionId: string;
  geometry: UVGeometry;
}

export interface Island {
  readonly index: number;
  readonly regionIds: ReadonlySet<string>;
  readonly bounds: Readonly<SelectionRect>;
  readonly pixelCount: number;
  readonly isRect: boolean;
  readonly isRemainder: boolean;
}

export interface NormalMapInput {
  size: Vec2;
  pixels: Uint8Array | Uint8ClampedArray;
  islands: IslandMap;
  config: NormalMapConfig | null;
}
