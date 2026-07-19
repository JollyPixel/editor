// Import Internal Dependencies
import { clamp, clampRectSize } from "../utils/math.ts";
import {
  TypedEventEmitter,
  type EventListener
} from "../utils/EventEmitter.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";
import type { UVRegion } from "./UVRegion.ts";

export type UVMapEvent =
  | { type: "region-created"; region: UVRegion; }
  | { type: "region-deleted"; region: UVRegion; }
  | { type: "region-moved"; region: UVRegion; previousRect: SelectionRect; }
  | { type: "region-dragging"; id: string; rect: SelectionRect; }
  | { type: "selection-changed"; selectedRegionId: string | null; }
  | { type: "visibility-changed"; showAll: boolean; };

export type UVMapEventType = UVMapEvent["type"];

export type UVMapListener<T extends UVMapEventType = UVMapEventType> = EventListener<UVMapEvent, T>;

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
const kPalette = [
  "#f94144",
  "#f3722c",
  "#f9c74f",
  "#90be6d",
  "#43aa8b",
  "#4d908e",
  "#577590",
  "#277da1"
];
const kCascadeStep = 16;

/**
 * Owns a texture's UV regions (create/delete/move) and the
 * selection/visibility state that governs which ones render, notifying
 * listeners of every change.
 */
export class UVMap extends TypedEventEmitter<UVMapEvent> implements Iterable<UVRegion> {
  #getCanvasSize: () => Vec2;
  #regions = new Map<string, UVRegion>();
  #selectedRegionId: string | null = null;
  #showAll = false;
  #cascadeIndex = 0;
  #paletteIndex = 0;

  constructor(
    options: UVMapOptions
  ) {
    super();
    this.#getCanvasSize = options.getCanvasSize;
  }

  /**
   * Every region, in insertion order. A live view over the internal store
   * (no array copy) — spread it (`[...uv.regions]`) if you need a snapshot.
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
    this.emit({
      type: "visibility-changed",
      showAll: value
    });
  }

  get(
    id: string
  ): UVRegion | undefined {
    return this.#regions.get(id);
  }

  canvasSize(): Vec2 {
    return this.#getCanvasSize();
  }

  /**
   * Whether a region should currently render.
   */
  isVisible(
    id: string
  ): boolean {
    return this.#showAll || this.#selectedRegionId === id;
  }

  /**
   * Selects a region for editing/visibility, or `null` to deselect.
   * Silently ignores unknown ids.
   */
  select(
    id: string | null
  ): void {
    if (id !== null && !this.#regions.has(id)) {
      return;
    }
    if (this.#selectedRegionId === id) {
      return;
    }

    this.#selectedRegionId = id;
    this.emit({
      type: "selection-changed",
      selectedRegionId: id
    });
  }

  /**
   * Creates a region at a cascading position, clamped to canvas bounds.
   */
  create(
    options: UVRegionCreateOptions
  ): UVRegion {
    const size = this.#getCanvasSize();
    const width = clamp(options.width, 1, Math.max(1, size.x));
    const height = clamp(options.height, 1, Math.max(1, size.y));
    const position = this.#nextCascadePosition(width, height, size);

    const region: UVRegion = {
      id: options.id ?? crypto.randomUUID(),
      rect: { x: position.x, y: position.y, width, height },
      color: options.color ?? this.#nextPaletteColor()
    };

    this.#regions.set(region.id, region);
    this.emit({
      type: "region-created",
      region
    });

    return region;
  }

  /**
   * Re-adds a region exactly as given, without cascading placement or
   * palette assignment. Used to replay undo/redo, remote commands, and
   * snapshots.
   */
  restore(
    region: UVRegion
  ): UVRegion {
    const stored: UVRegion = {
      ...region
    };
    this.#regions.set(stored.id, stored);

    this.emit({
      type: "region-created",
      region: stored
    });

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
    }
    this.emit({
      type: "region-deleted",
      region
    });

    return true;
  }

  move(
    id: string,
    rect: SelectionRect
  ): boolean {
    const region = this.#regions.get(id);
    if (!region) {
      return false;
    }

    const previousRect = region.rect;
    const clamped = clampRectSize(
      rect,
      this.#getCanvasSize()
    );
    const moved: UVRegion = {
      ...region,
      rect: clamped
    };
    this.#regions.set(id, moved);

    this.emit({
      type: "region-moved",
      region: moved,
      previousRect
    });

    return true;
  }

  /**
   * Emits a transient drag-preview position for a region: no store
   * mutation, no history entry, no network broadcast. Lets a consumer
   * (e.g. a 3D mesh mirroring the region) update live while a canvas drag
   * is in progress; the region's actual rect only changes once `move()`
   * commits it on drag end. Silently ignores an unknown id.
   */
  previewMove(
    id: string,
    rect: SelectionRect
  ): void {
    if (!this.#regions.has(id)) {
      return;
    }

    const clamped = clampRectSize(
      rect,
      this.#getCanvasSize()
    );
    this.emit({
      type: "region-dragging",
      id,
      rect: clamped
    });
  }

  /**
   * Removes every region and resets cascading placement.
   */
  clear(): void {
    for (const id of this.#regions.keys()) {
      this.delete(id);
    }
    this.#cascadeIndex = 0;
    this.#paletteIndex = 0;
  }

  #nextPaletteColor(): string {
    const color = kPalette[this.#paletteIndex % kPalette.length];
    this.#paletteIndex++;

    return color;
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
