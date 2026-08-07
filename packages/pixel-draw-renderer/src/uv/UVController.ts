// Import Internal Dependencies
import {
  clampRectPosition,
  pointInRect
} from "../utils/math.ts";
import type { UVMap } from "./UVMap.ts";
import type {
  UVFace,
  UVRegion
} from "./UVRegion.ts";
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
  face: UVFace | null;
  origin: Vec2;
  baseRect: SelectionRect;
  liveRect: SelectionRect;
}

/**
 * One hit-testable rect: a collapsed region (`face: null`) or one face of
 * an uncollapsed one.
 */
interface HitCandidate {
  region: UVRegion;
  face: UVFace | null;
  rect: SelectionRect;
}

/**
 * Last click location; identifies the stack to advance instead of re-picking.
 */
interface PickState {
  /**
   * Identifies the stack itself to detect repeat clicks.
   */
  key: string;
  index: number;
  regionId: string;
  face: UVFace | null;
}

function stackKey(
  candidates: HitCandidate[]
): string {
  return candidates
    .map((candidate) => `${candidate.region.id}:${candidate.face ?? "*"}`)
    .join("|");
}

/**
 * Routes canvas interaction (hit-test, drag, delete) to UVMap.
 * Repeat clicks advance through overlapping stacks.
 */
export class UVController {
  #uvMap: UVMap;
  #overlay: UVOverlay;
  #drag: DragState | null = null;
  #pick: PickState | null = null;

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
   * Advances through an overlapping stack on repeat clicks.
   */
  handleStart(
    pos: Vec2
  ): void {
    const candidates = this.#hitStack(pos);
    if (candidates.length === 0) {
      this.#pick = null;
      this.#uvMap.select(null);

      return;
    }

    const key = stackKey(candidates);
    const index = this.#shouldAdvance(key) ?
      (this.#pick!.index + 1) % candidates.length :
      0;
    const { region, face, rect } = candidates[index];

    this.#uvMap.select(region.id, face ?? undefined);
    this.#pick = {
      key,
      index,
      regionId: this.#uvMap.selectedRegionId!,
      face: this.#uvMap.selectedFace
    };
    this.#drag = {
      id: region.id,
      face,
      origin: pos,
      baseRect: { ...rect },
      liveRect: { ...rect }
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
      this.#drag.face,
      rect
    );
    this.#uvMap.previewMove(
      this.#drag.id,
      rect,
      this.#drag.face ?? undefined
    );
  }

  handleEnd(): void {
    if (!this.#drag) {
      return;
    }

    const { id, face, baseRect, liveRect } = this.#drag;
    this.#drag = null;

    if (
      liveRect.x !== baseRect.x ||
      liveRect.y !== baseRect.y
    ) {
      this.#uvMap.move(id, liveRect, face ?? undefined);
    }
    this.#overlay.setLiveOverride(
      id,
      face,
      null
    );
  }

  /**
   * Cancels the drag; reverts live preview to the actual rect.
   */
  cancelDrag(): void {
    this.#pick = null;
    if (!this.#drag) {
      return;
    }

    this.#overlay.setLiveOverride(
      this.#drag.id,
      this.#drag.face,
      null
    );
    this.#uvMap.previewMove(
      this.#drag.id,
      this.#drag.baseRect,
      this.#drag.face ?? undefined
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

    this.#pick = null;

    return this.#uvMap.delete(id);
  }

  /**
   * Advances only if this stack was just clicked and selection hasn't changed.
   */
  #shouldAdvance(
    key: string
  ): boolean {
    if (this.#pick === null || this.#pick.key !== key) {
      return false;
    }

    return this.#uvMap.selectedRegionId === this.#pick.regionId &&
      this.#uvMap.selectedFace === this.#pick.face;
  }

  /**
   * All visible rects under pos, topmost first (independent of selection).
   */
  #hitStack(
    pos: Vec2
  ): HitCandidate[] {
    const candidates: HitCandidate[] = [];

    for (const region of this.#uvMap.regions) {
      if (!this.#uvMap.isVisible(region.id)) {
        continue;
      }

      for (const { face, rect } of region.facesOf()) {
        if (pointInRect(pos, rect)) {
          candidates.push({ region, face, rect });
        }
      }
    }

    return candidates;
  }
}
