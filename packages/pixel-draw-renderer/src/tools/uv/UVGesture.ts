// Import Internal Dependencies
import { clampRectPosition } from "../../utils/math.ts";
import { sameRect } from "../../uv/geometry/geometry.ts";
import {
  UV_RESIZE_CURSORS,
  resizedRect,
  type UVResizeHandle
} from "../../uv/region/resizeHandles.ts";
import type { UVMap } from "../../uv/map/UVMap.ts";
import type {
  UVRegion,
  UVSlot
} from "../../uv/region/UVRegion.ts";
import type {
  SelectionRect,
  Vec2
} from "../../types.ts";

export interface UVGestureModifiers {
  aligned: boolean;
}

export interface UVGesture {
  readonly id: string;
  readonly cursor: string;
  readonly moved: boolean;
  move(pointer: Vec2): boolean;
  preview(modifiers: UVGestureModifiers): UVRegion | null;
  commit(modifiers: UVGestureModifiers): boolean;
  restore(): void;
}

export interface UVMoveGestureOptions {
  id: string;
  face: UVSlot | null;
  rect: SelectionRect;
  origin: Vec2;
}

export class UVMoveGesture implements UVGesture {
  readonly id: string;
  readonly cursor = "grabbing";
  #uvMap: UVMap;
  #face: UVSlot | undefined;
  #origin: Vec2;
  #baseRect: SelectionRect;
  #liveRect: SelectionRect;

  constructor(
    uvMap: UVMap,
    options: UVMoveGestureOptions
  ) {
    this.id = options.id;
    this.#uvMap = uvMap;
    this.#face = options.face ?? undefined;
    this.#origin = {
      x: Math.floor(options.origin.x),
      y: Math.floor(options.origin.y)
    };
    this.#baseRect = { ...options.rect };
    this.#liveRect = { ...options.rect };
  }

  get moved(): boolean {
    return !sameRect(this.#liveRect, this.#baseRect);
  }

  move(
    pointer: Vec2
  ): boolean {
    const rect = clampRectPosition(
      {
        ...this.#baseRect,
        x: this.#baseRect.x + Math.floor(pointer.x) - this.#origin.x,
        y: this.#baseRect.y + Math.floor(pointer.y) - this.#origin.y
      },
      this.#uvMap.canvasSize()
    );
    if (sameRect(rect, this.#liveRect)) {
      return false;
    }

    this.#liveRect = rect;

    return true;
  }

  preview(): UVRegion | null {
    return this.#uvMap.previewMove(this.id, this.#liveRect, this.#face);
  }

  commit(): boolean {
    return this.moved && this.#uvMap.move(this.id, this.#liveRect, this.#face);
  }

  restore(): void {
    this.#uvMap.previewMove(this.id, this.#baseRect, this.#face);
  }
}

export interface UVResizeGestureOptions {
  id: string;
  slot: UVSlot | undefined;
  handle: UVResizeHandle;
  rect: SelectionRect;
  origin: Vec2;
}

export class UVResizeGesture implements UVGesture {
  readonly id: string;
  readonly cursor: string;
  #uvMap: UVMap;
  #slot: UVSlot | undefined;
  #handle: UVResizeHandle;
  #origin: Vec2;
  #baseRect: SelectionRect;
  #liveRect: SelectionRect;

  constructor(
    uvMap: UVMap,
    options: UVResizeGestureOptions
  ) {
    this.id = options.id;
    this.cursor = UV_RESIZE_CURSORS[options.handle];
    this.#uvMap = uvMap;
    this.#slot = options.slot;
    this.#handle = options.handle;
    this.#origin = { ...options.origin };
    this.#baseRect = { ...options.rect };
    this.#liveRect = { ...options.rect };
  }

  get moved(): boolean {
    return !sameRect(this.#liveRect, this.#baseRect);
  }

  move(
    pointer: Vec2
  ): boolean {
    const rect = resizedRect(
      this.#baseRect,
      this.#handle,
      {
        x: Math.round(pointer.x - this.#origin.x),
        y: Math.round(pointer.y - this.#origin.y)
      }
    );
    if (sameRect(rect, this.#liveRect)) {
      return false;
    }

    this.#liveRect = rect;

    return true;
  }

  preview(
    modifiers: UVGestureModifiers
  ): UVRegion | null {
    return this.#uvMap.previewResize(
      this.id,
      this.#liveRect,
      this.#slot,
      modifiers
    );
  }

  commit(
    modifiers: UVGestureModifiers
  ): boolean {
    return this.#uvMap.resize(
      this.id,
      this.#liveRect,
      this.#slot,
      modifiers
    );
  }

  restore(): void {
    this.#uvMap.previewResize(this.id, this.#baseRect, this.#slot);
  }
}
