// Import Internal Dependencies
import {
  geometryKey,
  pointInGeometry
} from "../../uv/geometry/geometry.ts";
import { uvTargetKey } from "../../uv/region/UVTarget.ts";
import type { UVMap } from "../../uv/map/UVMap.ts";
import type {
  UVSlot,
  UVGeometry,
  UVRegion
} from "../../uv/region/UVRegion.ts";
import type { Vec2 } from "../../types.ts";

export interface UVPick {
  region: UVRegion;
  face: UVSlot | null;
  geometry: UVGeometry;
}

interface LastPick {
  key: string;
  index: number;
  regionId: string;
  face: UVSlot | null;
}

export class UVPickCycle {
  #uvMap: UVMap;
  #last: LastPick | null = null;

  constructor(
    uvMap: UVMap
  ) {
    this.#uvMap = uvMap;
  }

  reset(): void {
    this.#last = null;
  }

  pickAt(
    position: Vec2
  ): UVPick | null {
    const hits = this.#hitsAt(position);
    if (hits.length === 0) {
      this.reset();

      return null;
    }

    const candidates = this.#topStack(hits);
    const key = JSON.stringify(
      candidates.map(({ region, face }) => uvTargetKey({ regionId: region.id, slot: face }))
    );
    const last = this.#last;
    const index = last !== null && this.#advances(last, key) ?
      (last.index + 1) % candidates.length :
      Math.max(candidates.findIndex((candidate) => this.#isSelected(candidate)), 0);
    const pick = candidates[index];

    this.#uvMap.select(pick.region.id, pick.face);
    this.#last = {
      key,
      index,
      regionId: pick.region.id,
      face: this.#uvMap.selectedSlot
    };

    return pick;
  }

  #hitsAt(
    position: Vec2
  ): UVPick[] {
    const hits: UVPick[] = [];

    for (const region of this.#uvMap.regions) {
      if (!this.#uvMap.isVisible(region.id)) {
        continue;
      }

      for (const { slot: face, geometry } of region.slotsOf()) {
        if (pointInGeometry(position, geometry)) {
          hits.push({ region, face, geometry });
        }
      }
    }

    return hits;
  }

  #topStack(
    hits: UVPick[]
  ): UVPick[] {
    const top = hits.find((hit) => this.#isSelected(hit)) ?? hits[hits.length - 1];
    const key = geometryKey(top.geometry);

    return hits.filter((hit) => geometryKey(hit.geometry) === key);
  }

  #isSelected(
    pick: UVPick
  ): boolean {
    const selectedSlot = this.#uvMap.selectedSlot;

    return pick.region.id === this.#uvMap.selectedRegionId &&
      (selectedSlot === null || pick.face === selectedSlot);
  }

  #advances(
    last: LastPick,
    key: string
  ): boolean {
    return last.key === key &&
      this.#uvMap.selectedRegionId === last.regionId &&
      this.#uvMap.selectedSlot === last.face;
  }
}
