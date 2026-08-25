// Import Internal Dependencies
import type {
  RGBA8,
  SelectionRect,
  Vec2
} from "../types.ts";
import type {
  UVFace,
  UVRegionData
} from "../uv/UVRegion.ts";

export interface HistoryStrokeEntry {
  action: "stroke";
  timestamp: number;
  positions: Vec2[];
  beforeColors: RGBA8[];
  afterColor: RGBA8;
}

export interface HistoryResizedEntry {
  action: "resized";
  timestamp: number;
  beforeSize: Vec2;
  beforePixels: Uint8ClampedArray;
  afterSize: Vec2;
  afterPixels: Uint8ClampedArray;
}

export interface HistoryTextureReplacedEntry {
  action: "texture-replaced";
  timestamp: number;
  beforeSize: Vec2;
  beforePixels: Uint8ClampedArray;
  afterSize: Vec2;
  afterPixels: Uint8ClampedArray;
}

export interface HistorySelectEditEntry {
  action: "select-edit";
  timestamp: number;
  positions: Vec2[];
  beforeColors: RGBA8[];
  afterColors: RGBA8[];
  oldRect: SelectionRect;
  newRect: SelectionRect;
  oldMask: boolean[];
  newMask: boolean[];
}

export interface HistoryUvCreateEntry {
  action: "uv-create";
  timestamp: number;
  region: UVRegionData;
}

export interface HistoryUvDeleteEntry {
  action: "uv-delete";
  timestamp: number;
  region: UVRegionData;
}

export interface HistoryUvMoveEntry {
  action: "uv-move";
  timestamp: number;
  id: string;
  face: UVFace | null;
  oldRect: SelectionRect;
  newRect: SelectionRect;
}

export interface HistoryUvStateEntry {
  action: "uv-state";
  timestamp: number;
  id: string;
  before: UVRegionData;
  after: UVRegionData;
}

export type HistoryEntry =
  | HistoryStrokeEntry
  | HistoryResizedEntry
  | HistoryTextureReplacedEntry
  | HistorySelectEditEntry
  | HistoryUvCreateEntry
  | HistoryUvDeleteEntry
  | HistoryUvMoveEntry
  | HistoryUvStateEntry;

export type HistoryEntryInput =
  | Omit<HistoryStrokeEntry, "timestamp">
  | Omit<HistoryResizedEntry, "timestamp">
  | Omit<HistoryTextureReplacedEntry, "timestamp">
  | Omit<HistorySelectEditEntry, "timestamp">
  | Omit<HistoryUvCreateEntry, "timestamp">
  | Omit<HistoryUvDeleteEntry, "timestamp">
  | Omit<HistoryUvMoveEntry, "timestamp">
  | Omit<HistoryUvStateEntry, "timestamp">;
