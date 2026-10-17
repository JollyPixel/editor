// Import Third-party Dependencies
import {
  MemoryStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";
import {
  VoxelRotation,
  type VoxelRotationStep
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { StoredFields } from "./StoredFields.ts";

// CONSTANTS
const kStorageKey = "voxel-map:brush";

export const BRUSH_MIN_SIZE = 1;
export const BRUSH_MAX_SIZE = 16;
export const BRUSH_PATTERNS = Object.freeze([
  "square",
  "circle"
] as const);
export const BRUSH_MODES = Object.freeze([
  "build",
  "replace"
] as const);
export const ROTATION_MODES: readonly RotationMode[] = Object.freeze([
  "auto",
  ...Object.values(VoxelRotation)
]);

export type BrushPattern = typeof BRUSH_PATTERNS[number];
export type RotationMode = VoxelRotationStep | "auto";
export type BrushMode = typeof BRUSH_MODES[number];

export interface BrushOptions {
  size: number;
  rotationMode: RotationMode;
  flipY: boolean;
  mode: BrushMode;
  pattern: BrushPattern;
  ghost: boolean;
  skyRadius: number;
}

export type BrushStoreEvents = {
  change: (options: Readonly<BrushOptions>) => void;
  suspendedChange: (suspended: boolean) => void;
};

const kDefaultOptions: Readonly<BrushOptions> = Object.freeze({
  size: 1,
  rotationMode: "auto",
  flipY: false,
  mode: "build",
  pattern: "square",
  ghost: false,
  skyRadius: 24
});

export class BrushStore extends Emitter<BrushStoreEvents> {
  static parse(
    raw: string | null
  ): Readonly<BrushOptions> {
    const fields = StoredFields.parse(raw);

    return Object.freeze({
      size: clampSize(fields.number("size", kDefaultOptions.size)),
      rotationMode: fields.choice(
        "rotationMode",
        ROTATION_MODES,
        kDefaultOptions.rotationMode
      ),
      flipY: fields.boolean("flipY", kDefaultOptions.flipY),
      mode: fields.choice("mode", BRUSH_MODES, kDefaultOptions.mode),
      pattern: fields.choice("pattern", BRUSH_PATTERNS, kDefaultOptions.pattern),
      ghost: fields.boolean("ghost", kDefaultOptions.ghost),
      skyRadius: Math.max(
        0,
        fields.number("skyRadius", kDefaultOptions.skyRadius)
      )
    });
  }

  #storage: StorageAdapter;
  #suspended = false;
  #options: Readonly<BrushOptions>;

  constructor(
    storage: StorageAdapter = new MemoryStorageAdapter()
  ) {
    super();

    this.#storage = storage;
    this.#options = BrushStore.parse(storage.get(kStorageKey));
  }

  get suspended(): boolean {
    return this.#suspended;
  }

  set suspended(
    suspended: boolean
  ) {
    if (this.#suspended === suspended) {
      return;
    }

    this.#suspended = suspended;
    this.emit("suspendedChange", suspended);
  }

  get size(): number {
    return this.#options.size;
  }

  set size(
    size: number
  ) {
    this.#assign("size", clampSize(size));
  }

  get rotationMode(): RotationMode {
    return this.#options.rotationMode;
  }

  set rotationMode(
    mode: RotationMode
  ) {
    this.#assign("rotationMode", mode);
  }

  get flipY(): boolean {
    return this.#options.flipY;
  }

  set flipY(
    flipY: boolean
  ) {
    this.#assign("flipY", flipY);
  }

  get mode(): BrushMode {
    return this.#options.mode;
  }

  set mode(
    mode: BrushMode
  ) {
    this.#assign("mode", mode);
  }

  get pattern(): BrushPattern {
    return this.#options.pattern;
  }

  set pattern(
    pattern: BrushPattern
  ) {
    this.#assign("pattern", pattern);
  }

  get ghost(): boolean {
    return this.#options.ghost;
  }

  set ghost(
    ghost: boolean
  ) {
    this.#assign("ghost", ghost);
  }

  get skyRadius(): number {
    return this.#options.skyRadius;
  }

  set skyRadius(
    skyRadius: number
  ) {
    this.#assign("skyRadius", Math.max(0, skyRadius));
  }

  resize(
    delta: number
  ): void {
    this.size += delta;
  }

  #assign<TKey extends keyof BrushOptions>(
    key: TKey,
    value: BrushOptions[TKey]
  ): void {
    if (this.#options[key] === value) {
      return;
    }

    this.#options = Object.freeze({
      ...this.#options,
      [key]: value
    });
    this.#storage.set(kStorageKey, JSON.stringify(this.#options));
    this.emit("change", this.#options);
  }
}

function clampSize(
  size: number
): number {
  return Math.max(BRUSH_MIN_SIZE, Math.min(BRUSH_MAX_SIZE, size));
}
