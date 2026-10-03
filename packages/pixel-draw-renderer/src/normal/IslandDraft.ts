// Import Internal Dependencies
import {
  rectOf,
  sameRect
} from "../uv/geometry/geometry.ts";
import type { UVGeometry } from "../uv/geometry/types.ts";
import type { SelectionRect } from "../types.ts";
import type {
  Island,
  IslandFace
} from "./types.ts";

export class IslandDraft {
  #regionIds = new Set<string>();
  #rect: SelectionRect | null;
  #minX = Infinity;
  #minY = Infinity;
  #maxX = -Infinity;
  #maxY = -Infinity;
  #pixelCount = 0;
  #isRemainder: boolean;

  constructor(
    geometry: UVGeometry | null
  ) {
    this.#isRemainder = geometry === null;
    this.#rect = geometry === null || "shape" in geometry ?
      null :
      rectOf(geometry);
  }

  addFace(
    face: IslandFace
  ): void {
    this.#regionIds.add(face.regionId);
    if (
      this.#rect !== null &&
      ("shape" in face.geometry || !sameRect(this.#rect, face.geometry))
    ) {
      this.#rect = null;
    }
  }

  get isEmpty(): boolean {
    return this.#pixelCount === 0;
  }

  addSpan(
    fromX: number,
    toX: number,
    y: number
  ): void {
    this.#minX = Math.min(this.#minX, fromX);
    this.#minY = Math.min(this.#minY, y);
    this.#maxX = Math.max(this.#maxX, toX - 1);
    this.#maxY = Math.max(this.#maxY, y);
    this.#pixelCount += toX - fromX;
  }

  toIsland(
    index: number
  ): Island {
    return Object.freeze({
      index,
      regionIds: this.#regionIds,
      bounds: Object.freeze({
        x: this.#minX,
        y: this.#minY,
        width: this.#maxX - this.#minX + 1,
        height: this.#maxY - this.#minY + 1
      }),
      pixelCount: this.#pixelCount,
      isRect: this.#rect !== null,
      isRemainder: this.#isRemainder
    });
  }
}
