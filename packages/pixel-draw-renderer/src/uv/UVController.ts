// Import Internal Dependencies
import {
  clampRectPosition
} from "../utils/math.ts";
import { pointInGeometry } from "./geometry.ts";
import type { UVMap } from "./UVMap.ts";
import type {
  UVFace,
  UVGeometry,
  UVRegion
} from "./UVRegion.ts";
import type {
  UVRegionLayer
} from "../rendering/overlays/UVRegions.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";

export interface UVControllerOptions {
  uvMap: UVMap;
  overlay: UVRegionLayer;
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
  geometry: UVGeometry;
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
 * Advances repeat clicks through overlapping UV regions.
 */
export class UVController {
  #uvMap: UVMap;
  #overlay: UVRegionLayer;
  #drag: DragState | null = null;
  #pick: PickState | null = null;

  constructor(
    options: UVControllerOptions
  ) {
    this.#uvMap = options.uvMap;
    this.#overlay = options.overlay;
  }

  get isDragging(): boolean {
    return this.#drag !== null;
  }

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
    const { region, face, geometry } = candidates[index];
    const rect = "shape" in geometry ? geometry.rect : geometry;

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
      this.#uvMap.move(
        id,
        liveRect,
        face ?? undefined
      );
    }
    this.#overlay.setLiveOverride(
      id,
      face,
      null
    );
  }

  /**
   * Reverts the live preview to the stored geometry.
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

  handleDelete(): boolean {
    const id = this.#uvMap.selectedRegionId;
    if (id === null) {
      return false;
    }

    this.#pick = null;

    return this.#uvMap.delete(id);
  }

  #shouldAdvance(
    key: string
  ): boolean {
    if (
      this.#pick === null ||
      this.#pick.key !== key
    ) {
      return false;
    }

    return this.#uvMap.selectedRegionId === this.#pick.regionId &&
      this.#uvMap.selectedFace === this.#pick.face;
  }

  /**
   * Returns visible hits in topmost-first order, independent of selection.
   */
  #hitStack(
    pos: Vec2
  ): HitCandidate[] {
    const candidates: HitCandidate[] = [];

    for (const region of this.#uvMap.regions) {
      const isRegionVisible = this.#uvMap.isVisible(
        region.id
      );
      if (!isRegionVisible) {
        continue;
      }

      for (const { face, geometry } of region.facesOf()) {
        if (pointInGeometry(pos, geometry)) {
          candidates.push({
            region,
            face,
            geometry
          });
        }
      }
    }

    return candidates;
  }
}
