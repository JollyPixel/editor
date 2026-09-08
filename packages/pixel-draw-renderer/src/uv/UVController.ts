// Import Internal Dependencies
import {
  clampRectPosition
} from "../utils/math.ts";
import {
  geometryKey,
  pointInGeometry,
  rectOf
} from "./geometry.ts";
import { uvTargetKey } from "./UVTarget.ts";
import type { UVMap } from "./UVMap.ts";
import type {
  UVSlot,
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
  /**
   * Clears the selection when a click lands outside every visible region.
   * @default true
   */
  deselectOnEmptyClick?: boolean;
}

interface DragState {
  id: string;
  face: UVSlot | null;
  origin: Vec2;
  baseRect: SelectionRect;
  liveRect: SelectionRect;
}

interface HitCandidate {
  region: UVRegion;
  face: UVSlot | null;
  geometry: UVGeometry;
}

interface PickState {
  key: string;
  index: number;
  regionId: string;
  face: UVSlot | null;
}

function stackKey(
  candidates: HitCandidate[]
): string {
  return JSON.stringify(
    candidates.map((candidate) => uvTargetKey({
      regionId: candidate.region.id,
      slot: candidate.face
    }))
  );
}

function topIndex(
  candidates: HitCandidate[],
  selectedRegionId: string | null,
  selectedSlot: UVSlot | null
): number {
  if (selectedRegionId === null) {
    return candidates.length - 1;
  }

  const painted = candidates.findIndex(
    ({ region, face }) => region.id === selectedRegionId &&
      (selectedSlot === null || face === selectedSlot)
  );

  return painted === -1 ? candidates.length - 1 : painted;
}

function topStack(
  candidates: HitCandidate[],
  selectedRegionId: string | null,
  selectedSlot: UVSlot | null
): HitCandidate[] {
  const top = candidates[
    topIndex(candidates, selectedRegionId, selectedSlot)
  ];
  const key = geometryKey(top.geometry);

  return candidates.filter(
    (candidate) => geometryKey(candidate.geometry) === key
  );
}

/**
 * Advances repeat clicks through overlapping UV regions.
 */
export class UVController {
  #uvMap: UVMap;
  #overlay: UVRegionLayer;
  #drag: DragState | null = null;
  #pick: PickState | null = null;
  #deselectOnEmptyClick: boolean;

  constructor(
    options: UVControllerOptions
  ) {
    this.#uvMap = options.uvMap;
    this.#overlay = options.overlay;
    this.#deselectOnEmptyClick = options.deselectOnEmptyClick ?? true;
  }

  get isDragging(): boolean {
    return this.#drag !== null;
  }

  handleStart(
    pos: Vec2
  ): void {
    const hits = this.#hitStack(pos);
    if (hits.length === 0) {
      this.#pick = null;
      if (this.#deselectOnEmptyClick) {
        this.#uvMap.select(null);
      }

      return;
    }

    const selectedRegionId = this.#uvMap.selectedRegionId;
    const selectedSlot = this.#uvMap.selectedSlot;
    const candidates = topStack(hits, selectedRegionId, selectedSlot);
    const key = stackKey(candidates);
    const index = this.#shouldAdvance(key) ?
      (this.#pick!.index + 1) % candidates.length :
      Math.max(
        candidates.findIndex(
          ({ region, face }) => region.id === selectedRegionId &&
            (selectedSlot === null || face === selectedSlot)
        ),
        0
      );
    const { region, face, geometry } = candidates[index];
    const grouped = region.movementScope === "region";
    const rect = grouped ? region.bounds : rectOf(geometry);

    this.#uvMap.select(region.id, face ?? undefined);
    this.#pick = {
      key,
      index,
      regionId: this.#uvMap.selectedRegionId!,
      face: this.#uvMap.selectedSlot
    };
    this.#drag = {
      id: region.id,
      face: grouped ? null : face,
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

    let committed = false;
    if (
      liveRect.x !== baseRect.x ||
      liveRect.y !== baseRect.y
    ) {
      committed = this.#uvMap.move(
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
    this.#uvMap.emit("region-drag-ended", {
      id,
      committed
    });
  }

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
    this.#uvMap.emit("region-drag-ended", {
      id: this.#drag.id,
      committed: false
    });
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
      this.#uvMap.selectedSlot === this.#pick.face;
  }

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

      for (const { slot: face, geometry } of region.slotsOf()) {
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
