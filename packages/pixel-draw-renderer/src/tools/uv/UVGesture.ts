// Import Internal Dependencies
import { clampRectPosition } from "../../utils/math.ts";
import { sameRect } from "../../uv/geometry/geometry.ts";
import { UV_RESIZE_CURSORS } from "./resizeHandles.ts";
import { RectArea } from "../../utils/RectArea.ts";
import type { UVResizeHandle } from "../../uv/region/layout/UVResizeTarget.ts";
import type { UVMap } from "../../uv/map/UVMap.ts";
import type {
  UVLivePreview
} from "../../rendering/overlays/UVRegions.ts";
import type {
  UVRegion,
  UVResizeOptions,
  UVSlot
} from "../../uv/region/UVRegion.ts";
import type {
  SelectionRect,
  Vec2
} from "../../types.ts";

export interface UVGestureTarget {
  id: string;
  slot: UVSlot | null;
  rect: SelectionRect;
  origin: Vec2;
}

interface UVRectEdit {
  readonly cursor: string;
  rectAt(pointer: Vec2): SelectionRect;
  preview(rect: SelectionRect, options: UVResizeOptions): UVRegion | null;
  commit(rect: SelectionRect, options: UVResizeOptions): boolean;
}

export class UVGesture {
  readonly id: string;
  readonly #slot: UVSlot | null;
  readonly #edit: UVRectEdit;
  readonly #baseRect: SelectionRect;
  #liveRect: SelectionRect;

  static move(
    uvMap: UVMap,
    target: UVGestureTarget
  ): UVGesture {
    const { id, slot, rect } = target;
    const origin = {
      x: Math.floor(target.origin.x),
      y: Math.floor(target.origin.y)
    };

    return new UVGesture(target, {
      cursor: "grabbing",
      rectAt: (pointer) => clampRectPosition(
        {
          ...rect,
          x: rect.x + Math.floor(pointer.x) - origin.x,
          y: rect.y + Math.floor(pointer.y) - origin.y
        },
        uvMap.canvasSize()
      ),
      preview: (live) => uvMap.previewMove(id, live, slot),
      commit: (live) => uvMap.move(id, live, slot)
    });
  }

  static resize(
    uvMap: UVMap,
    target: UVGestureTarget,
    handle: UVResizeHandle
  ): UVGesture {
    const { id, slot, rect, origin } = target;

    return new UVGesture(target, {
      cursor: UV_RESIZE_CURSORS[handle],
      rectAt: (pointer) => RectArea.from(rect).resized(handle, {
        x: Math.round(pointer.x - origin.x),
        y: Math.round(pointer.y - origin.y)
      }).bounds,
      preview: (live, options) => uvMap.previewResize(id, live, slot, options),
      commit: (live, options) => uvMap.resize(id, live, slot, options)
    });
  }

  constructor(
    target: UVGestureTarget,
    edit: UVRectEdit
  ) {
    this.id = target.id;
    this.#slot = target.slot;
    this.#edit = edit;
    this.#baseRect = { ...target.rect };
    this.#liveRect = { ...target.rect };
  }

  get cursor(): string {
    return this.#edit.cursor;
  }

  get moved(): boolean {
    return !sameRect(this.#liveRect, this.#baseRect);
  }

  move(
    pointer: Vec2
  ): boolean {
    const rect = this.#edit.rectAt(pointer);
    if (sameRect(rect, this.#liveRect)) {
      return false;
    }

    this.#liveRect = rect;

    return true;
  }

  preview(
    options: UVResizeOptions
  ): UVLivePreview | null {
    const region = this.#edit.preview(this.#liveRect, options);

    return region === null ? null : { region, slot: this.#slot };
  }

  commit(
    options: UVResizeOptions
  ): boolean {
    return this.moved && this.#edit.commit(this.#liveRect, options);
  }

  restore(): void {
    this.#edit.preview(this.#baseRect, {});
  }
}
