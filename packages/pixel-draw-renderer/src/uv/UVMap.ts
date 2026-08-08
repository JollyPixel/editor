// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { clamp, clampRectSize } from "../utils/math.ts";
import { ColorPalette } from "../utils/ColorPalette.ts";
import { geometryAt } from "./geometry.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";
import {
  UV_FACES,
  UVRegion,
  type UVFace,
  type UVRegionData
} from "./UVRegion.ts";
import type { UVMapEvent } from "./UVMap.events.ts";

export type {
  UVMapEvent,
  UVMapEventType,
  UVMapListener
} from "./UVMap.events.ts";

export interface UVMapOptions {
  getCanvasSize: () => Vec2;
}

export interface UVRegionCreateOptions {
  width: number;
  height: number;
  activeFaces?: readonly UVFace[];
  faceGeometries?: Partial<Record<UVFace, UVFaceGeometryTemplate>>;
  /**
   * @default a generated id
   */
  id?: string;
  /**
   * @default the next color in the built-in palette
   */
  color?: string;
}

export type UVFaceGeometryTemplate =
  | { shape: "rectangle"; }
  | { shape: "triangle"; corner: "top-left" | "top-right" | "bottom-left" | "bottom-right"; };

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

    const rect = {
      x: position.x,
      y: position.y,
      width,
      height
    };
    const identity = {
      id: options.id ?? crypto.randomUUID(),
      color: options.color ?? this.#palette.next()
    };
    const region = options.activeFaces || options.faceGeometries ?
      new UVRegion({
        ...identity,
        state: "uncollapsed",
        activeFaces: [...(options.activeFaces ?? UV_FACES)],
        faces: {
          front: this.#geometryFrom(options.faceGeometries?.front, rect),
          back: this.#geometryFrom(options.faceGeometries?.back, rect),
          left: this.#geometryFrom(options.faceGeometries?.left, rect),
          right: this.#geometryFrom(options.faceGeometries?.right, rect),
          top: this.#geometryFrom(options.faceGeometries?.top, rect),
          bottom: this.#geometryFrom(options.faceGeometries?.bottom, rect)
        }
      }) :
      new UVRegion({ ...identity, state: "collapsed", rect });

    this.#regions.set(region.id, region);
    this.emit("region-created", {
      region
    });

    return region;
  }

  restore(
    region: UVRegion | UVRegionData
  ): UVRegion {
    const stored = UVRegion.from(region);
    this.#regions.set(stored.id, stored);

    this.emit("region-created", {
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

    this.emit("region-moved", {
      region: moved,
      face: target,
      previousRect
    });

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
    this.emit("region-dragging", {
      id,
      face: target,
      rect: clamped,
      geometry: geometryAt(
        region.geometryFor(target ?? kDefaultFace),
        clamped
      )
    });
  }

  uncollapse(
    id: string
  ): boolean {
    return this.#changeState(
      id,
      (region) => region.uncollapse()
    );
  }

  collapse(
    id: string,
    face: UVFace = kDefaultFace
  ): boolean {
    return this.#changeState(
      id,
      (region) => region.collapse(face)
    );
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

    this.emit("region-state-changed", {
      region: next,
      previous
    });
    if (selectionChanged) {
      this.#emitSelectionChanged();
    }

    return true;
  }

  #resolveFace(
    region: UVRegion,
    face: UVFace | undefined
  ): UVFace | null | undefined {
    if (region.state === "collapsed") {
      return null;
    }

    return face ?? undefined;
  }

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

  #geometryFrom(
    template: UVFaceGeometryTemplate | undefined,
    rect: SelectionRect
  ) {
    return template?.shape === "triangle" ?
      { shape: "triangle" as const, corner: template.corner, rect } :
      rect;
  }
}
