// Import Internal Dependencies
import { sameRect } from "../../uv/geometry/geometry.ts";
import { UV_RESIZE_CURSORS } from "./resizeHandles.ts";
import { RectArea } from "../../utils/RectArea.ts";
import type { UVResizeHandle } from "../../uv/region/layout/UVResizeTarget.ts";
import type {
  UVMap,
  UVMove
} from "../../uv/map/UVMap.ts";
import type {
  UVLivePreview
} from "../../rendering/overlays/UVRegions.ts";
import type { UVSlot } from "../../uv/region/UVRegion.ts";
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
  preview(rect: SelectionRect, lineHeld: boolean): UVLivePreview | null;
  commit(rect: SelectionRect, lineHeld: boolean): boolean;
}

export class UVGesture {
  readonly id: string;
  readonly #edit: UVRectEdit;
  readonly #baseRect: SelectionRect;
  #liveRect: SelectionRect;

  static move(
    uvMap: UVMap,
    target: UVGestureTarget,
    nested: readonly UVMove[]
  ): UVGesture {
    return new UVGesture(target, new UVMoveEdit(uvMap, target, nested));
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
      preview: (live, lineHeld) => {
        const region = uvMap.previewResize(id, live, slot, { aligned: lineHeld });

        return region === null ? null : { regions: [region], slot };
      },
      commit: (live, lineHeld) => uvMap.resize(id, live, slot, { aligned: lineHeld })
    });
  }

  constructor(
    target: UVGestureTarget,
    edit: UVRectEdit
  ) {
    this.id = target.id;
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
    lineHeld: boolean
  ): UVLivePreview | null {
    return this.#edit.preview(this.#liveRect, lineHeld);
  }

  commit(
    lineHeld: boolean
  ): boolean {
    return this.moved && this.#edit.commit(this.#liveRect, lineHeld);
  }

  restore(): void {
    this.#edit.preview(this.#baseRect, false);
  }
}

class UVMoveEdit implements UVRectEdit {
  readonly cursor = "grabbing";
  readonly #uvMap: UVMap;
  readonly #dragged: UVMove;
  readonly #origin: Vec2;
  readonly #nested: readonly UVMove[];
  #nestedDisplaced = false;

  constructor(
    uvMap: UVMap,
    target: UVGestureTarget,
    nested: readonly UVMove[]
  ) {
    this.#uvMap = uvMap;
    this.#dragged = {
      id: target.id,
      slot: target.slot,
      rect: { ...target.rect }
    };
    this.#origin = {
      x: Math.floor(target.origin.x),
      y: Math.floor(target.origin.y)
    };
    this.#nested = nested;
  }

  rectAt(
    pointer: Vec2
  ): SelectionRect {
    const { rect } = this.#dragged;

    return this.#uvMap.bounds.fit({
      ...rect,
      x: rect.x + Math.floor(pointer.x) - this.#origin.x,
      y: rect.y + Math.floor(pointer.y) - this.#origin.y
    });
  }

  preview(
    rect: SelectionRect,
    lineHeld: boolean
  ): UVLivePreview | null {
    const moves = [this.#draggedTo(rect)];
    if (lineHeld) {
      moves.push(...this.#nestedFollowing(rect));
    }
    else if (this.#nestedDisplaced) {
      moves.push(...this.#nested);
    }
    this.#nestedDisplaced = lineHeld;

    const regions = this.#uvMap.previewMoveGroup(moves);
    if (!regions.some((region) => region.id === this.#dragged.id)) {
      return null;
    }

    return {
      regions,
      slot: this.#dragged.slot
    };
  }

  commit(
    rect: SelectionRect,
    lineHeld: boolean
  ): boolean {
    const moves = [this.#draggedTo(rect)];
    if (lineHeld) {
      moves.push(...this.#nestedFollowing(rect));
    }

    return this.#uvMap.moveGroup(moves);
  }

  #draggedTo(
    rect: SelectionRect
  ): UVMove {
    return {
      ...this.#dragged,
      rect
    };
  }

  #nestedFollowing(
    rect: SelectionRect
  ): UVMove[] {
    const dx = rect.x - this.#dragged.rect.x;
    const dy = rect.y - this.#dragged.rect.y;

    return this.#nested.map((move) => {
      return {
        ...move,
        rect: {
          ...move.rect,
          x: move.rect.x + dx,
          y: move.rect.y + dy
        }
      };
    });
  }
}
