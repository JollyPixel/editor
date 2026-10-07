// Import Internal Dependencies
import type { VoxelCoord } from "../world/types.ts";

// CONSTANTS
const kSpan = 2 ** 26;
const kBias = 2 ** 25;

export interface VoxelKeyCell {
  readonly layerId: string;
  readonly position: VoxelCoord;
}

export class VoxelKeySet {
  readonly layers: ReadonlySet<string>;

  #cells = new Map<string, Map<number, Set<number>>>();
  #cellCount = 0;

  constructor(
    cells: Iterable<VoxelKeyCell>,
    layers: Iterable<string> = []
  ) {
    this.layers = new Set(layers);
    for (const { layerId, position } of cells) {
      this.#add(layerId, position);
    }
  }

  get cellCount(): number {
    return this.#cellCount;
  }

  overlaps(
    other: VoxelKeySet
  ): boolean {
    return this.#coversLayerOf(other) ||
      other.#coversLayerOf(this) ||
      this.#cellsOverlap(other);
  }

  * cells(): IterableIterator<VoxelKeyCell> {
    for (const [layerId, columns] of this.#cells) {
      for (const [x, packed] of columns) {
        for (const yz of packed) {
          yield {
            layerId,
            position: {
              x,
              y: Math.floor(yz / kSpan) - kBias,
              z: (yz % kSpan) - kBias
            }
          };
        }
      }
    }
  }

  #coversLayerOf(
    other: VoxelKeySet
  ): boolean {
    for (const layerId of this.layers) {
      if (other.layers.has(layerId) || other.#cells.has(layerId)) {
        return true;
      }
    }

    return false;
  }

  #cellsOverlap(
    other: VoxelKeySet
  ): boolean {
    const [small, large] = this.#cellCount <= other.#cellCount ?
      [this, other] :
      [other, this];
    for (const { layerId, position } of small.cells()) {
      if (large.#has(layerId, position)) {
        return true;
      }
    }

    return false;
  }

  #has(
    layerId: string,
    position: VoxelCoord
  ): boolean {
    return this.#cells.get(layerId)
      ?.get(position.x)
      ?.has(packYZ(position.y, position.z)) ?? false;
  }

  #add(
    layerId: string,
    position: VoxelCoord
  ): void {
    let columns = this.#cells.get(layerId);
    if (columns === undefined) {
      columns = new Map();
      this.#cells.set(layerId, columns);
    }

    let column = columns.get(position.x);
    if (column === undefined) {
      column = new Set();
      columns.set(position.x, column);
    }

    const before = column.size;
    column.add(packYZ(position.y, position.z));
    this.#cellCount += column.size - before;
  }
}

function packYZ(
  y: number,
  z: number
): number {
  return ((y + kBias) * kSpan) + z + kBias;
}
