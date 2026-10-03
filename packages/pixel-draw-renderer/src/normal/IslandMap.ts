// Import Internal Dependencies
import {
  pointInGeometry,
  rectOf
} from "../uv/geometry/geometry.ts";
import type { UVGeometry } from "../uv/geometry/types.ts";
import type { UVRegion } from "../uv/region/UVRegion.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";
import { RectArea } from "../utils/RectArea.ts";
import { IslandDraft } from "./IslandDraft.ts";
import type {
  Island,
  IslandFace
} from "./types.ts";

export class IslandMap {
  readonly size: Readonly<Vec2>;
  readonly islands: readonly Island[];
  readonly indices: Int32Array;

  static fromRegions(
    size: Vec2,
    regions: Iterable<UVRegion>
  ): IslandMap {
    const faces: IslandFace[] = [];
    for (const region of regions) {
      for (const { geometry } of region.slotsOf()) {
        faces.push({
          regionId: region.id,
          geometry
        });
      }
    }

    return IslandMap.fromFaces(
      size,
      faces
    );
  }

  static fromFaces(
    size: Vec2,
    faces: Iterable<IslandFace>
  ): IslandMap {
    const { x: width, y: height } = size;

    const owners = new Int32Array(
      width * height
    ).fill(-1);
    const parents: number[] = [];
    const covered: IslandFace[] = [];
    function find(
      face: number
    ): number {
      let root = face;
      while (parents[root] !== root) {
        parents[root] = parents[parents[root]];
        root = parents[root];
      }

      return root;
    }

    for (const face of faces) {
      const faceIndex = covered.length;
      let covers = false;

      for (const index of IslandMap.#coveredPixels(face.geometry, size)) {
        if (!covers) {
          covers = true;
          parents.push(faceIndex);
          covered.push(face);
        }

        const owner = owners[index];
        if (owner === -1) {
          owners[index] = faceIndex;
          continue;
        }

        const a = find(owner);
        const b = find(faceIndex);
        if (a !== b) {
          parents[Math.max(a, b)] = Math.min(a, b);
        }
      }
    }

    const drafts: IslandDraft[] = [];
    const islandOfFace = new Int32Array(covered.length);
    for (let face = 0; face < covered.length; face++) {
      const root = find(face);

      if (root === face) {
        islandOfFace[face] = drafts.length;
        drafts.push(new IslandDraft(covered[face].geometry));
      }
      else {
        islandOfFace[face] = islandOfFace[root];
      }
      drafts[islandOfFace[face]].addFace(covered[face]);
    }

    const indices = new Int32Array(width * height);
    const remainder = new IslandDraft(null);
    const remainderIndex = drafts.length;
    drafts.push(remainder);
    for (let y = 0; y < height; y++) {
      let spanStart = 0;
      let spanIsland = -1;
      let pixel = y * width;
      for (let x = 0; x < width; x++, pixel++) {
        const owner = owners[pixel];
        const island = owner === -1 ? remainderIndex : islandOfFace[owner];
        indices[pixel] = island;
        if (island !== spanIsland) {
          drafts[spanIsland]?.addSpan(spanStart, x, y);
          spanIsland = island;
          spanStart = x;
        }
      }
      drafts[spanIsland]?.addSpan(spanStart, width, y);
    }

    const islands = drafts
      .filter((draft) => draft !== remainder || !remainder.isEmpty)
      .map((draft, index) => draft.toIsland(index));

    return new IslandMap(
      size,
      islands,
      indices
    );
  }

  static* #coveredPixels(
    geometry: UVGeometry,
    size: Vec2
  ): IterableIterator<number> {
    const bounds = rectOf(geometry);
    const isRect = !("shape" in geometry);
    const minX = Math.max(0, Math.ceil(bounds.x - 0.5));
    const minY = Math.max(0, Math.ceil(bounds.y - 0.5));
    const maxX = Math.min(size.x, Math.ceil(bounds.x + bounds.width - 0.5));
    const maxY = Math.min(size.y, Math.ceil(bounds.y + bounds.height - 0.5));
    const center: Vec2 = { x: 0, y: 0 };

    if (isRect) {
      for (let y = minY; y < maxY; y++) {
        for (let x = minX; x < maxX; x++) {
          yield (y * size.x) + x;
        }
      }

      return;
    }

    for (let y = minY; y < maxY; y++) {
      center.y = y + 0.5;
      for (let x = minX; x < maxX; x++) {
        center.x = x + 0.5;
        if (pointInGeometry(center, geometry)) {
          yield (y * size.x) + x;
        }
      }
    }
  }

  constructor(
    size: Vec2,
    islands: readonly Island[],
    indices: Int32Array
  ) {
    this.size = Object.freeze({
      x: size.x,
      y: size.y
    });
    this.islands = Object.freeze([
      ...islands
    ]);
    this.indices = indices;
  }

  get remainder(): Island | null {
    const last = this.islands.at(-1);

    return last?.isRemainder ? last : null;
  }

  islandAt(
    x: number,
    y: number
  ): Island | null {
    if (x < 0 || y < 0 || x >= this.size.x || y >= this.size.y) {
      return null;
    }

    return this.islands[this.indices[(y * this.size.x) + x]];
  }

  islandsOf(
    regionId: string
  ): Island[] {
    return this.islands.filter(
      (island) => island.regionIds.has(regionId)
    );
  }

  islandsWithin(
    rect: SelectionRect
  ): Island[] {
    const found = new Set<number>();

    for (const row of RectArea.from(rect).rowsWithin(this.size)) {
      const end = row.indexInBounds + row.length;
      for (let pixel = row.indexInBounds; pixel < end; pixel++) {
        found.add(this.indices[pixel]);
      }
    }

    return [...found]
      .sort((a, b) => a - b)
      .map((index) => this.islands[index]);
  }
}
