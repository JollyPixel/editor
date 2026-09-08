// Import Internal Dependencies
import {
  clampRectPosition
} from "../utils/math.ts";
import {
  geometryKey,
  pointInGeometry,
  rectOf
} from "./geometry.ts";
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
  return candidates
    .map((candidate) => `${candidate.region.id}:${candidate.face ?? "*"}`)
    .join("|");
}

function topIndex(
  candidates: HitCandidate[],
  selectedRegionId: string | null,
  selectedFace: UVSlot | null
): number {
  if (selectedRegionId === null) {
    return candidates.length - 1;
  }

  const painted = candidates.findIndex(
    ({ region, face }) => region.id === selectedRegionId &&
      (selectedFace === null || face === selectedFace)
  );

  return painted === -1 ? candidates.length - 1 : painted;
}

function topStack(
  candidates: HitCandidate[],
  selectedRegionId: string | null,
  selectedFace: UVSlot | null
): HitCandidate[] {
  const top = candidates[
    topIndex(candidates, selectedRegionId, selectedFace)
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
    const selectedFace = this.#uvMap.selectedFace;
    const candidates = topStack(hits, selectedRegionId, selectedFace);
    const key = stackKey(candidates);
    const index = this.#shouldAdvance(key) ?
      (this.#pick!.index + 1) % candidates.length :
      Math.max(
        candidates.findIndex(
          ({ region, face }) => region.id === selectedRegionId &&
            (selectedFace === null || face === selectedFace)
        ),
        0
      );
    const { region, face, geometry } = candidates[index];
    const grouped = region.state === "unfolded";
    const rect = grouped ? region.bounds : rectOf(geometry);

    this.#uvMap.select(region.id, face ?? undefined);
    this.#pick = {
      key,
      index,
      regionId: this.#uvMap.selectedRegionId!,
      face: this.#uvMap.selectedFace
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
