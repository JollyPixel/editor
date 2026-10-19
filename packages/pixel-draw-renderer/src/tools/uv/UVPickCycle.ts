// Import Internal Dependencies
import {
  geometryKey,
  pointInGeometry
} from "../../uv/geometry/geometry.ts";
import {
  uvTargetKey,
  type UVTarget
} from "../../uv/region/UVTarget.ts";
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

interface UVStack {
  key: string;
  targets: UVTarget[];
  index: number;
  face: UVSlot | null;
}

export class UVPickCycle {
  #uvMap: UVMap;
  #stack: UVStack | null = null;
  #cycleOnRelease = false;

  constructor(
    uvMap: UVMap
  ) {
    this.#uvMap = uvMap;
  }

  reset(): void {
    this.#stack = null;
    this.#cycleOnRelease = false;
  }

  press(
    position: Vec2
  ): UVPick | null {
    this.#cycleOnRelease = false;
    const hits = this.#hitsAt(position);
    if (hits.length === 0) {
      this.reset();

      return null;
    }

    const candidates = this.#topStack(hits);
    const targets = candidates.map(({ region, face }) => {
      return {
        regionId: region.id,
        slot: face
      };
    });
    const key = JSON.stringify(targets.map(uvTargetKey));
    const stack = this.#stack;
    if (stack !== null && stack.key === key && this.#holds(stack)) {
      this.#cycleOnRelease = true;

      return candidates[stack.index];
    }

    const index = Math.max(
      candidates.findIndex((candidate) => this.#isSelected(candidate)),
      0
    );
    this.#select({ key, targets, index });

    return candidates[index];
  }

  release(): void {
    const stack = this.#stack;
    if (this.#cycleOnRelease && stack !== null && this.#holds(stack)) {
      this.#select({
        ...stack,
        index: (stack.index + 1) % stack.targets.length
      });
    }
    this.#cycleOnRelease = false;
  }

  #select(
    stack: Omit<UVStack, "face">
  ): void {
    const { regionId, slot } = stack.targets[stack.index];

    this.#uvMap.select(regionId, slot);
    this.#stack = {
      ...stack,
      face: this.#uvMap.selectedSlot
    };
  }

  #hitsAt(
    position: Vec2
  ): UVPick[] {
    const hits: UVPick[] = [];

    for (const region of this.#uvMap.regions) {
      if (!this.#uvMap.isVisible(region.id)) {
        continue;
      }

      for (const { slot: face, geometry } of region.listSlots()) {
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

  #holds(
    stack: UVStack
  ): boolean {
    const { regionId } = stack.targets[stack.index];

    return this.#uvMap.selectedRegionId === regionId &&
      this.#uvMap.selectedSlot === stack.face;
  }
}
