// Import Internal Dependencies
import { rectOf } from "../../uv/geometry/geometry.ts";
import {
  UV_RESIZE_CURSORS,
  resizeHandleAt,
  type UVResizeHit
} from "./resizeHandles.ts";
import { UVGesture } from "./UVGesture.ts";
import { UVPickCycle } from "./UVPickCycle.ts";
import type { UVMap } from "../../uv/map/UVMap.ts";
import type {
  UVRegionLayer
} from "../../rendering/overlays/UVRegions.ts";
import type { ScreenProjection } from "../../rendering/Viewport.ts";
import type {
  RotationDirection,
  Vec2
} from "../../types.ts";

export interface UVControllerOptions {
  uvMap: UVMap;
  overlay: UVRegionLayer;
  /**
   * Clears the selection when a click lands outside every visible region.
   * @default true
   */
  deselectOnEmptyClick?: boolean;
  viewport: ScreenProjection;
  resizable?: boolean;
}

export interface UVTool {
  resizable: boolean;
}

export class UVController implements UVTool {
  #uvMap: UVMap;
  #overlay: UVRegionLayer;
  #gesture: UVGesture | null = null;
  #picks: UVPickCycle;
  #deselectOnEmptyClick: boolean;
  #viewport: ScreenProjection;
  #resizable: boolean;
  #hoverPoint: Vec2 | null = null;
  #aligned = false;

  constructor(
    options: UVControllerOptions
  ) {
    this.#uvMap = options.uvMap;
    this.#overlay = options.overlay;
    this.#picks = new UVPickCycle(options.uvMap);
    this.#deselectOnEmptyClick = options.deselectOnEmptyClick ?? true;
    this.#viewport = options.viewport;
    this.#resizable = options.resizable ?? false;
    this.#overlay.resizeHandles = this.#resizable;
  }

  get resizable(): boolean {
    return this.#resizable;
  }

  set resizable(
    value: boolean
  ) {
    if (this.#resizable === value) {
      return;
    }
    if (!value) {
      this.cancelDrag();
    }
    this.#resizable = value;
    this.#overlay.resizeHandles = value;
  }

  get cursor(): string {
    if (this.#gesture !== null) {
      return this.#gesture.cursor;
    }

    const hit = this.#hoverPoint === null ?
      null :
      this.#resizeHit(this.#hoverPoint);

    return hit === null ? "grab" : UV_RESIZE_CURSORS[hit.handle];
  }

  alignEdges(
    value: boolean
  ): void {
    if (this.#aligned === value) {
      return;
    }

    this.#aligned = value;
    if (this.#gesture?.moved) {
      this.#showPreview(this.#gesture);
    }
  }

  hover(
    point: Vec2 | null
  ): void {
    this.#hoverPoint = point === null ?
      null :
      {
        x: point.x,
        y: point.y
      };
  }

  handleStart(
    point: Vec2
  ): void {
    const pointer = this.#viewport.toTexture(point);
    const handle = this.#resizeHit(point);
    if (handle !== null) {
      this.#picks.reset();
      this.#gesture = UVGesture.resize(
        this.#uvMap,
        { id: handle.id, slot: handle.slot, rect: handle.rect, origin: pointer },
        handle.handle
      );

      return;
    }

    const position = {
      x: Math.floor(pointer.x),
      y: Math.floor(pointer.y)
    };
    const pick = this.#picks.pickAt(position);
    if (pick === null) {
      if (this.#deselectOnEmptyClick) {
        this.#uvMap.select(null);
      }

      return;
    }

    const { region, face, geometry } = pick;
    const grouped = region.movementScope === "region";
    this.#gesture = UVGesture.move(this.#uvMap, {
      id: region.id,
      slot: grouped ? null : face,
      rect: grouped ? region.bounds : rectOf(geometry),
      origin: position
    });
  }

  handleMove(
    point: Vec2
  ): void {
    const gesture = this.#gesture;
    if (gesture?.move(this.#viewport.toTexture(point))) {
      this.#showPreview(gesture);
    }
  }

  handleEnd(): void {
    this.#finish(true);
  }

  cancelDrag(): void {
    this.#picks.reset();
    this.#finish(false);
  }

  rotate(
    direction: RotationDirection
  ): boolean {
    const id = this.#uvMap.selectedRegionId;
    if (id === null || this.#gesture !== null) {
      return false;
    }

    return this.#uvMap.rotate(id, direction, this.#uvMap.selectedSlot);
  }

  handleDelete(): boolean {
    const id = this.#uvMap.selectedRegionId;
    if (id === null) {
      return false;
    }

    this.#picks.reset();

    return this.#uvMap.delete(id);
  }

  #showPreview(
    gesture: UVGesture
  ): void {
    this.#overlay.setLivePreview(
      gesture.preview({
        aligned: this.#aligned
      })
    );
  }

  #finish(
    commit: boolean
  ): void {
    const gesture = this.#gesture;
    if (gesture === null) {
      return;
    }

    this.#gesture = null;
    const committed = commit && gesture.commit({ aligned: this.#aligned });
    if (!commit) {
      gesture.restore();
    }
    this.#overlay.setLivePreview(null);
    this.#uvMap.endPreview(gesture.id, committed);
  }

  #resizeHit(
    point: Vec2
  ): UVResizeHit | null {
    const id = this.#uvMap.selectedRegionId;
    if (!this.#resizable || id === null) {
      return null;
    }

    const region = this.#uvMap.get(id);
    if (!region || !this.#uvMap.isVisible(id)) {
      return null;
    }

    return resizeHandleAt(
      region.resizeTargets(this.#uvMap.selectedSlot),
      point,
      this.#viewport
    );
  }
}
