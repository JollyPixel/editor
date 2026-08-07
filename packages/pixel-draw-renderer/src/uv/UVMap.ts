// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { clamp, clampRectSize } from "../utils/math.ts";
import { ColorPalette } from "../utils/ColorPalette.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";
import {
  UVRegion,
  type UVFace,
  type UVRegionData
} from "./UVRegion.ts";

export type UVMapEvent = {
  "region-created": (event: { region: UVRegion; }) => void;
  "region-deleted": (event: { region: UVRegion; }) => void;
  "region-moved": (event: {
    region: UVRegion;
    face: UVFace | null;
    previousRect: SelectionRect;
  }) => void;
  "region-dragging": (event: {
    id: string;
    face: UVFace | null;
    rect: SelectionRect;
  }) => void;
  "region-state-changed": (event: {
    region: UVRegion;
    previous: UVRegionData;
  }) => void;
  "selection-changed": (event: {
    selectedRegionId: string | null;
    selectedFace: UVFace | null;
  }) => void;
  "visibility-changed": (event: { showAll: boolean; }) => void;
};

export type UVMapEventType = keyof UVMapEvent;

export type UVMapListener<T extends UVMapEventType = UVMapEventType> = UVMapEvent[T];

export interface UVMapOptions {
  /**
   * Reports the current texture/canvas size, used to clamp region
   * placement and size.
   */
  getCanvasSize: () => Vec2;
}

export interface UVRegionCreateOptions {
  width: number;
  height: number;
  /**
   * @default a generated id
   */
  id?: string;
  /**
   * @default the next color in the built-in palette
   */
  color?: string;
}

// CONSTANTS
const kCascadeStep = 16;
const kDefaultFace: UVFace = "front";

/**
 * Manages UV regions: create/delete/move/collapse/uncollapse and selection/visibility state.
 */
export class UVMap extends Emitter<
  UVMapEvent
> implements Iterable<UVRegion> {
  #getCanvasSize: () => Vec2;
  #regions = new Map<string, UVRegion>();
  #selectedRegionId: string | null = null;
  #selectedFace: UVFace | null = null;
  #showAll = false;
  #cascadeIndex = 0;
  #palette = new ColorPalette();

  constructor(
    options: UVMapOptions
  ) {
    super();
    this.#getCanvasSize = options.getCanvasSize;
  }

  /**
   * All regions in insertion order (live view, spread for a snapshot).
   */
  get regions(): IterableIterator<UVRegion> {
    return this.#regions.values();
  }

  [Symbol.iterator](): IterableIterator<UVRegion> {
    return this.#regions.values();
  }

  get selectedRegionId(): string | null {
    return this.#selectedRegionId;
  }

  /**
   * Selected face within the selected region (always `null` when collapsed).
   */
  get selectedFace(): UVFace | null {
    return this.#selectedFace;
  }

  get showAll(): boolean {
    return this.#showAll;
  }

  set showAll(
    value: boolean
  ) {
    if (this.#showAll === value) {
      return;
    }

    this.#showAll = value;
    this.emit("visibility-changed", { showAll: value });
  }

  get(
    id: string
  ): UVRegion | undefined {
    return this.#regions.get(id);
  }

  canvasSize(): Vec2 {
    return this.#getCanvasSize();
  }

  isVisible(
    id: string
  ): boolean {
    return this.#showAll || this.#selectedRegionId === id;
  }

  select(
    id: string | null,
    face?: UVFace
  ): void {
    if (this.#applySelection(id, face ?? null)) {
      this.#emitSelectionChanged();
    }
  }

  create(
    options: UVRegionCreateOptions
  ): UVRegion {
    const size = this.#getCanvasSize();
    const width = clamp(options.width, 1, Math.max(1, size.x));
    const height = clamp(options.height, 1, Math.max(1, size.y));
    const position = this.#nextCascadePosition(width, height, size);

    const region = new UVRegion({
      id: options.id ?? crypto.randomUUID(),
      color: options.color ?? this.#palette.next(),
      state: "collapsed",
      rect: { x: position.x, y: position.y, width, height }
    });

    this.#regions.set(region.id, region);
    this.emit("region-created", { region });

    return region;
  }

  restore(
    region: UVRegion | UVRegionData
  ): UVRegion {
    const stored = UVRegion.from(region);
    this.#regions.set(stored.id, stored);

    this.emit("region-created", { region: stored });

    return stored;
  }

  delete(
    id: string
  ): boolean {
    const region = this.#regions.get(id);
    if (!region) {
      return false;
    }

    this.#regions.delete(id);
    if (this.#selectedRegionId === id) {
      this.#selectedRegionId = null;
      this.#selectedFace = null;
    }
    this.emit("region-deleted", { region });

    return true;
  }

  move(
    id: string,
    rect: SelectionRect,
    face?: UVFace
  ): boolean {
    const region = this.#regions.get(id);
    if (!region) {
      return false;
    }

    const target = this.#resolveFace(region, face);
    if (target === undefined) {
      return false;
    }

    const previousRect = region.rectFor(target ?? kDefaultFace);
    const clamped = clampRectSize(
      rect,
      this.#getCanvasSize()
    );
    const moved = region.withRect(clamped, target ?? undefined);
    this.#regions.set(id, moved);

    this.emit("region-moved", { region: moved, face: target, previousRect });

    return true;
  }

  previewMove(
    id: string,
    rect: SelectionRect,
    face?: UVFace
  ): void {
    const region = this.#regions.get(id);
    if (!region) {
      return;
    }

    const target = this.#resolveFace(region, face);
    if (target === undefined) {
      return;
    }

    const clamped = clampRectSize(
      rect,
      this.#getCanvasSize()
    );
    this.emit("region-dragging", { id, face: target, rect: clamped });
  }

  uncollapse(
    id: string
  ): boolean {
    return this.#changeState(id, (region) => region.uncollapse());
  }

  collapse(
    id: string,
    face: UVFace = kDefaultFace
  ): boolean {
    return this.#changeState(id, (region) => region.collapse(face));
  }

  restoreState(
    value: UVRegion | UVRegionData
  ): boolean {
    const next = UVRegion.from(value);

    return this.#changeState(next.id, () => next);
  }

  clear(): void {
    for (const id of this.#regions.keys()) {
      this.delete(id);
    }
    this.#cascadeIndex = 0;
    this.#palette.reset();
  }

  #changeState(
    id: string,
    transform: (region: UVRegion) => UVRegion
  ): boolean {
    const region = this.#regions.get(id);
    if (!region) {
      return false;
    }

    const next = transform(region);
    if (next === region) {
      return false;
    }

    const previous = region.toJSON();
    this.#regions.set(id, next);

    // Selection is normalized before events fire so listeners see a consistent state.
    const selectionChanged = this.#applySelection(
      this.#selectedRegionId,
      this.#selectedFace
    );

    this.emit("region-state-changed", { region: next, previous });
    if (selectionChanged) {
      this.#emitSelectionChanged();
    }

    return true;
  }

  /**
   * Normalizes face against the region's state: null when collapsed, face (or default) when uncollapsed.
   */
  #resolveFace(
    region: UVRegion,
    face: UVFace | undefined
  ): UVFace | null | undefined {
    if (region.state === "collapsed") {
      return null;
    }

    return face ?? undefined;
  }

  /**
   * Stores the normalized selection; returns whether anything changed.
   */
  #applySelection(
    id: string | null,
    face: UVFace | null
  ): boolean {
    if (id === null) {
      const changed = this.#selectedRegionId !== null || this.#selectedFace !== null;
      this.#selectedRegionId = null;
      this.#selectedFace = null;

      return changed;
    }

    const region = this.#regions.get(id);
    if (!region) {
      return false;
    }

    const nextFace = region.state === "collapsed" ?
      null :
      face ?? kDefaultFace;
    const changed = this.#selectedRegionId !== id || this.#selectedFace !== nextFace;
    this.#selectedRegionId = id;
    this.#selectedFace = nextFace;

    return changed;
  }

  #emitSelectionChanged(): void {
    this.emit("selection-changed", {
      selectedRegionId: this.#selectedRegionId,
      selectedFace: this.#selectedFace
    });
  }

  #nextCascadePosition(
    width: number,
    height: number,
    size: Vec2
  ): Vec2 {
    const maxX = Math.max(0, size.x - width);
    const maxY = Math.max(0, size.y - height);
    const colsPerRow = Math.max(1, Math.floor(maxX / kCascadeStep) + 1);

    const col = this.#cascadeIndex % colsPerRow;
    const row = Math.floor(this.#cascadeIndex / colsPerRow);
    this.#cascadeIndex++;

    return {
      x: clamp(col * kCascadeStep, 0, maxX),
      y: clamp(row * kCascadeStep, 0, maxY)
    };
  }
}
