// Import Internal Dependencies
import {
  geometryKey,
  pointInGeometry,
  rectOf
} from "../../uv/geometry/geometry.ts";
import {
  UV_RESIZE_CURSORS,
  resizeHandleAt,
  resizeTargets,
  type UVResizeHit,
  type UVView
} from "../../uv/region/resizeHandles.ts";
import {
  UVMoveGesture,
  UVResizeGesture,
  type UVGesture
} from "./UVGesture.ts";
import { uvTargetKey } from "../../uv/region/UVTarget.ts";
import type { UVMap } from "../../uv/map/UVMap.ts";
import type {
  UVSlot,
  UVGeometry,
  UVRegion
} from "../../uv/region/UVRegion.ts";
import type {
  UVRegionLayer
} from "../../rendering/overlays/UVRegions.ts";
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
  viewport: UVView;
  resizable?: boolean;
}

export interface UVTool {
  resizable: boolean;
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
export class UVController implements UVTool {
  #uvMap: UVMap;
  #overlay: UVRegionLayer;
  #gesture: UVGesture | null = null;
  #pick: PickState | null = null;
  #deselectOnEmptyClick: boolean;
  #viewport: UVView;
  #resizable: boolean;
  #hoverPoint: Vec2 | null = null;
  #aligned = false;

  constructor(
    options: UVControllerOptions
  ) {
    this.#uvMap = options.uvMap;
    this.#overlay = options.overlay;
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
    const pointer = this.#texturePoint(point);
    const handle = this.#resizeHit(point);
    if (handle !== null) {
      this.#pick = null;
      this.#gesture = new UVResizeGesture(this.#uvMap, {
        id: handle.id,
        slot: handle.slot,
        handle: handle.handle,
        rect: handle.rect,
        origin: pointer
      });

      return;
    }

    const pos = {
      x: Math.floor(pointer.x),
      y: Math.floor(pointer.y)
    };
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

    this.#uvMap.select(region.id, face ?? undefined);
    this.#pick = {
      key,
      index,
      regionId: this.#uvMap.selectedRegionId!,
      face: this.#uvMap.selectedSlot
    };
    this.#gesture = new UVMoveGesture(this.#uvMap, {
      id: region.id,
      face: grouped ? null : face,
      rect: grouped ? region.bounds : rectOf(geometry),
      origin: pos
    });
  }

  handleMove(
    point: Vec2
  ): void {
    const gesture = this.#gesture;
    if (gesture?.move(this.#texturePoint(point))) {
      this.#showPreview(gesture);
    }
  }

  handleEnd(): void {
    this.#finish(true);
  }

  cancelDrag(): void {
    this.#pick = null;
    this.#finish(false);
  }

  rotate(
    direction: RotationDirection
  ): boolean {
    const id = this.#uvMap.selectedRegionId;
    if (id === null || this.#gesture !== null) {
      return false;
    }

    return this.#uvMap.rotate(
      id,
      direction,
      this.#uvMap.selectedSlot ?? undefined
    );
  }

  handleDelete(): boolean {
    const id = this.#uvMap.selectedRegionId;
    if (id === null) {
      return false;
    }

    this.#pick = null;

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
    let committed = false;
    if (commit) {
      committed = gesture.commit({
        aligned: this.#aligned
      });
    }
    else {
      gesture.restore();
    }
    this.#overlay.setLivePreview(null);
    this.#uvMap.emit("region-drag-ended", {
      id: gesture.id,
      committed
    });
  }

  #texturePoint(
    point: Vec2
  ): Vec2 {
    const zoom = this.#viewport.zoom.value;
    const camera = this.#viewport.camera;

    return {
      x: (point.x - camera.x) / zoom,
      y: (point.y - camera.y) / zoom
    };
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
      resizeTargets(region, this.#uvMap.selectedSlot),
      point,
      this.#viewport
    );
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
