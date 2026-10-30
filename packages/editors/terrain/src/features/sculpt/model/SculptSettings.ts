// Import Third-party Dependencies
import {
  CHUNK_TIERS,
  HEIGHT_RANGE,
  type ChunkTier
} from "@jolly-pixel/terrain.renderer";
import {
  MemoryStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  CHUNK_MODES,
  type ChunkMode
} from "../../chunks/model/ChunkDrag.ts";
import {
  HOLE_MODES,
  type HoleMode
} from "../../holes/model/holeStamp.ts";
import {
  FALLOFF_CURVES,
  type FalloffCurve
} from "./falloff.ts";
import { SCULPT_TOOLS } from "./sculptStamp.ts";

// CONSTANTS
const kStorageKey = "terrain:sculpt";

export const BRUSH_SIZE = Object.freeze({ min: 0.5, max: 128 });
export const BRUSH_SPACING = Object.freeze({ min: 0.05, max: 1 });
export const FLATTEN_TARGETS = ["press", "fixed"] as const;
export const BRUSH_TOOLS = Object.freeze([...SCULPT_TOOLS, "paint", "holes", "chunks"] as const);
export const STRENGTH_OPTIONS: Readonly<Record<BrushTool, StrengthOption | null>> = Object.freeze({
  raise: "strength",
  smooth: "strength",
  flatten: "strength",
  paint: "paintStrength",
  holes: null,
  chunks: null
});

export type FlattenTarget = typeof FLATTEN_TARGETS[number];
export type BrushTool = typeof BRUSH_TOOLS[number];
export type StrengthOption = "strength" | "paintStrength";

export interface SculptOptions {
  tool: BrushTool;
  size: number;
  strength: number;
  paintStrength: number;
  falloff: FalloffCurve;
  spacing: number;
  flattenTarget: FlattenTarget;
  flattenHeight: number;
  holeMode: HoleMode;
  chunkMode: ChunkMode;
  chunkTier: ChunkTier;
}

export type SculptSettingsEvents = {
  change: (options: Readonly<SculptOptions>) => void;
};

const kDefaultOptions: Readonly<SculptOptions> = Object.freeze({
  tool: "raise",
  size: 8,
  strength: 0.25,
  paintStrength: 0.5,
  falloff: "smooth",
  spacing: 0.25,
  flattenTarget: "press",
  flattenHeight: 0,
  holeMode: "cut",
  chunkMode: "add",
  chunkTier: 2
});

export class SculptSettings extends Emitter<SculptSettingsEvents> {
  static parse(
    raw: string | null
  ): Readonly<SculptOptions> {
    const stored = parseObject(raw);
    function number(key: keyof SculptOptions): number {
      const value = stored[key];

      return typeof value === "number" && Number.isFinite(value) ? value : kDefaultOptions[key] as number;
    }
    function choice<T>(key: keyof SculptOptions, values: readonly T[]): T {
      return values.find((known) => known === stored[key]) ?? kDefaultOptions[key] as T;
    }

    return Object.freeze({
      tool: choice("tool", BRUSH_TOOLS),
      size: clamp(number("size"), BRUSH_SIZE.min, BRUSH_SIZE.max),
      strength: clamp(number("strength"), 0, 1),
      paintStrength: clamp(number("paintStrength"), 0, 1),
      falloff: choice("falloff", FALLOFF_CURVES),
      spacing: clamp(number("spacing"), BRUSH_SPACING.min, BRUSH_SPACING.max),
      flattenTarget: choice("flattenTarget", FLATTEN_TARGETS),
      flattenHeight: clamp(number("flattenHeight"), HEIGHT_RANGE.min, HEIGHT_RANGE.max),
      holeMode: choice("holeMode", HOLE_MODES),
      chunkMode: choice("chunkMode", CHUNK_MODES),
      chunkTier: choice("chunkTier", CHUNK_TIERS)
    });
  }

  #storage: StorageAdapter;
  #options: Readonly<SculptOptions>;

  constructor(
    storage: StorageAdapter = new MemoryStorageAdapter()
  ) {
    super();

    this.#storage = storage;
    this.#options = SculptSettings.parse(storage.get(kStorageKey));
  }

  get options(): Readonly<SculptOptions> {
    return this.#options;
  }

  update(
    changes: Partial<SculptOptions>
  ): void {
    const next = SculptSettings.parse(JSON.stringify({ ...this.#options, ...changes }));
    if ((Object.keys(next) as (keyof SculptOptions)[]).every((key) => next[key] === this.#options[key])) {
      return;
    }

    this.#options = next;
    this.#storage.set(kStorageKey, JSON.stringify(next));
    this.emit("change", next);
  }
}

function parseObject(
  raw: string | null
): Partial<Record<keyof SculptOptions, unknown>> {
  try {
    const value: unknown = raw === null ? null : JSON.parse(raw);

    return typeof value === "object" && value !== null ? value : {};
  }
  catch {
    return {};
  }
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(Math.max(value, min), max);
}
