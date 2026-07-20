// Import Internal Dependencies
import {
  clampRectPosition,
  pointInRect
} from "../utils/math.ts";
import type { UVMap } from "./UVMap.ts";
import type { UVRegion } from "./UVRegion.ts";
import type {
  UVOverlay
} from "../rendering/overlays/UVOverlay.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";

export interface UVControllerOptions {
  uvMap: UVMap;
  overlay: UVOverlay;
}

interface DragState {
  id: string;
  origin: Vec2;
  baseRect: SelectionRect;
  liveRect: SelectionRect;
}

/**
 * Routes canvas interaction (hit-test, drag-to-move, delete) to a `UVMap`.
 * Creation is API-only (see `UVMap.create`) and has no canvas gesture.
 */
export class UVController {
  #uvMap: UVMap;
  #overlay: UVOverlay;
  #drag: DragState | null = null;

  constructor(
    options: UVControllerOptions
  ) {
    this.#uvMap = options.uvMap;
    this.#overlay = options.overlay;
  }

  /**
   * Whether a region is currently being dragged.
   */
  get isDragging(): boolean {
    return this.#drag !== null;
  }

  /**
   * Selects the hit region, or deselects on a miss.
   */
  handleStart(
    pos: Vec2
  ): void {
    const hit = this.#hitTest(pos);
    if (!hit) {
      this.#uvMap.select(null);

      return;
    }

    this.#uvMap.select(hit.id);
    this.#drag = {
      id: hit.id,
      origin: pos,
      baseRect: { ...hit.rect },
      liveRect: { ...hit.rect }
    };
  }

  handleMove(
    pos: Vec2
  ): void {
    if (!this.#drag) {
      return;
    }

    const dx = pos.x - this.#drag.origin.x;
    const dy = pos.y - this.#drag.origin.y;
    const rect = clampRectPosition(
      {
        ...this.#drag.baseRect,
        x: this.#drag.baseRect.x + dx,
        y: this.#drag.baseRect.y + dy
      },
      this.#uvMap.canvasSize()
    );

    this.#drag.liveRect = rect;
    this.#overlay.setLiveOverride(
      this.#drag.id,
      rect
    );
    this.#uvMap.previewMove(
      this.#drag.id,
      rect
    );
  }

  handleEnd(): void {
    if (!this.#drag) {
      return;
    }

    const { id, baseRect, liveRect } = this.#drag;
    this.#drag = null;

    if (
      liveRect.x !== baseRect.x ||
      liveRect.y !== baseRect.y
    ) {
      this.#uvMap.move(id, liveRect);
    }
    this.#overlay.setLiveOverride(
      id,
      null
    );
  }

  /**
   * Cancels an in-progress drag without committing the move. Reverts any
   * live drag-preview back to the region's actual (unchanged) rect, so a
   * consumer following `"region-dragging"` doesn't stay stuck showing an
   * uncommitted position.
   */
  cancelDrag(): void {
    if (!this.#drag) {
      return;
    }

    this.#overlay.setLiveOverride(
      this.#drag.id,
      null
    );
    this.#uvMap.previewMove(
      this.#drag.id,
      this.#drag.baseRect
    );
    this.#drag = null;
  }

  /**
   * Deletes the selected region.
   */
  handleDelete(): boolean {
    const id = this.#uvMap.selectedRegionId;
    if (id === null) {
      return false;
    }

    return this.#uvMap.delete(id);
  }

  #hitTest(
    pos: Vec2
  ): UVRegion | null {
    for (const region of this.#uvMap.regions) {
      if (!this.#uvMap.isVisible(region.id)) {
        continue;
      }
      if (pointInRect(pos, region.rect)) {
        return region;
      }
    }

    return null;
  }
}
