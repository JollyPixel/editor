// Import Internal Dependencies
import type {
  RGBA,
  SelectionRect,
  Vec2
} from "../types.ts";
import type { UVRegion } from "../uv/UVRegion.ts";

export interface HistoryStrokeEntry {
  action: "stroke";
  timestamp: number;
  positions: Vec2[];
  beforeColors: RGBA[];
  afterColor: RGBA;
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

/**
 * Stores pixels and selection state before and after a selection edit.
 */
export interface HistorySelectEditEntry {
  action: "select-edit";
  timestamp: number;
  positions: Vec2[];
  beforeColors: RGBA[];
  afterColors: RGBA[];
  oldRect: SelectionRect;
  newRect: SelectionRect;
  oldMask: boolean[];
  newMask: boolean[];
}

export interface HistoryUvCreateEntry {
  action: "uv-create";
  timestamp: number;
  region: UVRegion;
}

export interface HistoryUvDeleteEntry {
  action: "uv-delete";
  timestamp: number;
  region: UVRegion;
}

export interface HistoryUvMoveEntry {
  action: "uv-move";
  timestamp: number;
  id: string;
  oldRect: SelectionRect;
  newRect: SelectionRect;
}

export type HistoryEntry =
  | HistoryStrokeEntry
  | HistoryResizedEntry
  | HistoryTextureReplacedEntry
  | HistorySelectEditEntry
  | HistoryUvCreateEntry
  | HistoryUvDeleteEntry
  | HistoryUvMoveEntry;

export type HistoryEntryInput =
  | Omit<HistoryStrokeEntry, "timestamp">
  | Omit<HistoryResizedEntry, "timestamp">
  | Omit<HistoryTextureReplacedEntry, "timestamp">
  | Omit<HistorySelectEditEntry, "timestamp">
  | Omit<HistoryUvCreateEntry, "timestamp">
  | Omit<HistoryUvDeleteEntry, "timestamp">
  | Omit<HistoryUvMoveEntry, "timestamp">;
