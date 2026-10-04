// Import Internal Dependencies
import {
  geometryAt,
  rectOf,
  sameRect
} from "../../geometry/geometry.ts";
import type { UVSlotMap } from "../UVSlotMap.ts";
import { SpreadLayout } from "./SpreadLayout.ts";
import type {
  UVLayout,
  UVMovementScope
} from "./UVLayout.ts";
import {
  UV_EVERY_RESIZE_HANDLE,
  type UVLayoutResizeTarget
} from "./UVResizeTarget.ts";
import type {
  UVGeometry,
  UVSlot
} from "../../geometry/types.ts";
import type {
  SelectionRect,
  Vec2
} from "../../../types.ts";

export class FreeLayout extends SpreadLayout {
  readonly state = "free";
  readonly movementScope: UVMovementScope = "slot";

  static freeing(
    layout: UVLayout
  ): FreeLayout {
    return new FreeLayout(layout.spreadFaces(), layout.activeSlots);
  }

  rectFor(
    slot: UVSlot | null
  ): SelectionRect {
    return slot === null ? this.bounds : rectOf(this.faces.get(slot));
  }

  movedTo(
    position: Vec2,
    slot: UVSlot | null
  ): FreeLayout {
    if (!this.isTarget(slot)) {
      return this;
    }

    const geometry = this.faces.get(slot);
    const rect = rectOf(geometry);
    if (rect.x === position.x && rect.y === position.y) {
      return this;
    }

    return this.#withSlot(slot, geometryAt(geometry, {
      ...rect,
      x: position.x,
      y: position.y
    }));
  }

  resized(
    rect: SelectionRect,
    slot: UVSlot | null
  ): FreeLayout {
    if (!this.isTarget(slot) || sameRect(rectOf(this.faces.get(slot)), rect)) {
      return this;
    }

    return this.#withSlot(slot, geometryAt(this.faces.get(slot), rect));
  }

  rotated(
    turns: number,
    slot: UVSlot | null
  ): FreeLayout {
    if (!this.isTarget(slot)) {
      return this;
    }

    return this.withFaces(this.faces.rotated(turns, [slot]));
  }

  override withGeometry(
    slot: UVSlot,
    geometry: UVGeometry
  ): FreeLayout {
    return this.isTarget(slot) ? this.#withSlot(slot, geometry) : this;
  }

  resizeTargets(
    selectedSlot: UVSlot | null
  ): UVLayoutResizeTarget[] {
    if (!this.isTarget(selectedSlot)) {
      return [];
    }

    return [
      {
        slot: selectedSlot,
        rect: this.rectFor(selectedSlot),
        handles: UV_EVERY_RESIZE_HANDLE
      }
    ];
  }

  withFaces(
    faces: UVSlotMap
  ): FreeLayout {
    return new FreeLayout(faces, this.activeSlots);
  }

  #withSlot(
    slot: UVSlot,
    geometry: UVGeometry
  ): FreeLayout {
    return this.withFaces(this.faces.withSlot(slot, geometry));
  }
}
