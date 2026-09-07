// Import Third-party Dependencies
import { ColorPalette } from "@jolly-pixel/color";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { clamp, clampRectSize } from "../utils/math.ts";
import { geometryAt } from "./geometry.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";
import { UVSlotMap } from "./UVSlotMap.ts";
import {
  UV_FACES,
  UVRegion,
  type UVSlot,
  type UVRegionData,
  type UVRegionState
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
  name?: string;
  activeFaces?: readonly UVSlot[];
  faceGeometries?: Partial<Record<UVSlot, UVSlotGeometryTemplate>>;
  /**
   * @default "free" for regions with topology, otherwise "stacked"
   */
  state?: UVRegionState;
  /**
   * @default a generated id
   */
  id?: string;
  /**
   * @default the next color in the built-in palette
   */
  color?: string;
}

export type UVSlotGeometryTemplate =
  | { shape: "rectangle"; }
  | { shape: "triangle"; corner: "top-left" | "top-right" | "bottom-left" | "bottom-right"; };

// CONSTANTS
const kCascadeStep = 16;
const kDefaultFace: UVSlot = "front";

export class UVMap extends Emitter<
  UVMapEvent
> implements Iterable<UVRegion> {
  #getCanvasSize: () => Vec2;
  #regions = new Map<string, UVRegion>();
  #selectedRegionId: string | null = null;
  #selectedFace: UVSlot | null = null;
  #showAll = false;
  #showRegionLabels = false;
  #cascadeIndex = 0;
  #palette = new ColorPalette();

  constructor(
    options: UVMapOptions
  ) {
    super();
    this.#getCanvasSize = options.getCanvasSize;
  }

  get regions(): IterableIterator<UVRegion> {
    return this.#regions.values();
  }

  [Symbol.iterator](): IterableIterator<UVRegion> {
    return this.#regions.values();
  }

  get selectedRegionId(): string | null {
    return this.#selectedRegionId;
  }

  get selectedFace(): UVSlot | null {
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

  get showRegionLabels(): boolean {
    return this.#showRegionLabels;
  }

  set showRegionLabels(
    value: boolean
  ) {
    if (this.#showRegionLabels === value) {
      return;
    }

    this.#showRegionLabels = value;
    this.emit("label-visibility-changed", { showRegionLabels: value });
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
    face?: UVSlot
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
    const position = this.#nextCascadePosition(
      width,
      height,
      size
    );

    const rect = {
      x: position.x,
      y: position.y,
      width,
      height
    };
    const identity = {
      id: options.id ?? crypto.randomUUID(),
      name: options.name,
      color: options.color ?? this.#palette.next()
    };
    const hasTopology = options.activeFaces !== undefined || options.faceGeometries !== undefined;
    const state = options.state ?? (hasTopology ? "free" : "stacked");
    const faces = UVSlotMap.map(
      (face) => this.#geometryFrom(options.faceGeometries?.[face], rect)
    );
    const activeFaces = [
      ...(options.activeFaces ?? UV_FACES)
    ];
    let region: UVRegion;
    if (state === "stacked") {
      region = hasTopology ?
        new UVRegion({
          ...identity,
          state,
          rect,
          activeFaces,
          faces
        }) :
        new UVRegion({
          ...identity,
          state,
          rect
        });
    }
    else {
      const spread = new UVRegion({
        ...identity,
        state: "free",
        activeFaces,
        faces
      });
      region = state === "unfolded" ?
        this.#clamped(spread.unfold()) :
        spread;
    }

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
    if (this.#regions.has(stored.id)) {
      this.restoreState(stored);

      return this.#regions.get(stored.id) ?? stored;
    }

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
    const selectionChanged = this.#selectedRegionId === id;
    if (selectionChanged) {
      this.#selectedRegionId = null;
      this.#selectedFace = null;
    }
    this.emit(
      "region-deleted",
      { region }
    );
    if (selectionChanged) {
      this.#emitSelectionChanged();
    }

    return true;
  }

  move(
    id: string,
    rect: SelectionRect,
    face?: UVSlot
  ): boolean {
    const region = this.#regions.get(id);
    if (!region) {
      return false;
    }

    const target = this.#resolveFace(region, face);
    if (target === undefined) {
      return false;
    }

    const previousRect = region.rectFor(
      target ?? kDefaultFace
    );
    const clamped = clampRectSize(
      rect,
      this.#getCanvasSize()
    );
    const moved = region.withRect(
      clamped,
      target ?? undefined
    );
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
    face?: UVSlot
  ): void {
    const region = this.#regions.get(id);
    if (!region) {
      return;
    }

    const target = this.#resolveFace(
      region,
      face
    );
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
        target === null ? region.bounds : region.geometryFor(target),
        clamped
      )
    });
  }

  setState(
    id: string,
    state: UVRegionState,
    face?: UVSlot
  ): boolean {
    return this.#changeState(
      id,
      (region) => {
        switch (state) {
          case "stacked":
            return region.stack(face);
          case "unfolded":
            return this.#clamped(region.unfold());
          default:
            return region.free();
        }
      }
    );
  }

  restoreState(
    value: UVRegion | UVRegionData
  ): boolean {
    const next = UVRegion.from(value);

    return this.#changeState(
      next.id,
      () => next
    );
  }

  clear(): void {
    for (const id of [...this.#regions.keys()]) {
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

    // Normalize selection before events expose the new state.
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
    face: UVSlot | undefined
  ): UVSlot | null | undefined {
    if (region.state !== "free") {
      return null;
    }

    return face !== undefined && region.faces.includes(face) ?
      face :
      undefined;
  }

  #applySelection(
    id: string | null,
    face: UVSlot | null
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

    const activeFaces = region.facesOf()
      .map(({ face: activeFace }) => activeFace)
      .filter((activeFace) => activeFace !== null);
    let nextFace: UVSlot | null = null;
    if (region.state === "free") {
      const firstActiveFace = activeFaces[0] ?? null;
      nextFace = face !== null && activeFaces.includes(face) ? face : firstActiveFace;
    }
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
    const colsPerRow = Math.max(
      1,
      Math.floor(maxX / kCascadeStep) + 1
    );

    const col = this.#cascadeIndex % colsPerRow;
    const row = Math.floor(this.#cascadeIndex / colsPerRow);
    this.#cascadeIndex++;

    return {
      x: clamp(col * kCascadeStep, 0, maxX),
      y: clamp(row * kCascadeStep, 0, maxY)
    };
  }

  #clamped(
    region: UVRegion
  ): UVRegion {
    const bounds = region.bounds;
    const size = this.#getCanvasSize();

    return region.translated({
      x: clamp(bounds.x, 0, Math.max(0, size.x - bounds.width)) - bounds.x,
      y: clamp(bounds.y, 0, Math.max(0, size.y - bounds.height)) - bounds.y
    });
  }

  #geometryFrom(
    template: UVSlotGeometryTemplate | undefined,
    rect: SelectionRect
  ) {
    return template?.shape === "triangle" ?
      { shape: "triangle" as const, corner: template.corner, rect } :
      rect;
  }
}
