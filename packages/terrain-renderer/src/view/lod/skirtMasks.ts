// Import Internal Dependencies
import { LEAF_NODE_SIZE } from "./LodRanges.ts";

// CONSTANTS
const kCellSize = LEAF_NODE_SIZE / 2;
const kEdgeProbes = [0.125, 0.375, 0.625, 0.875];

export const SKIRT_EDGES = [
  { bit: 1, outward: [0, -1] },
  { bit: 2, outward: [1, 0] },
  { bit: 4, outward: [0, 1] },
  { bit: 8, outward: [-1, 0] }
] as const;

export interface NodeArea {
  readonly level: number;
  readonly x: number;
  readonly z: number;
  readonly size: number;
}

export function skirtMasks(
  nodes: readonly NodeArea[]
): number[] {
  const cells = new Map<string, NodeArea>();
  for (const node of nodes) {
    for (let z = node.z; z < node.z + node.size; z += kCellSize) {
      for (let x = node.x; x < node.x + node.size; x += kCellSize) {
        cells.set(cellKey(x, z), node);
      }
    }
  }

  return nodes.map((node) => {
    let mask = 0;
    for (const { bit, outward: [outX, outZ] } of SKIRT_EDGES) {
      const differs = kEdgeProbes.some((along) => {
        const x = outX === 0 ? node.x + along * node.size : edgeOutside(node.x, node.size, outX);
        const z = outZ === 0 ? node.z + along * node.size : edgeOutside(node.z, node.size, outZ);
        const neighbour = cells.get(cellKey(x, z));

        return neighbour !== undefined && neighbour.level !== node.level;
      });
      if (differs) {
        mask |= bit;
      }
    }

    return mask;
  });
}

function edgeOutside(
  start: number,
  size: number,
  direction: number
): number {
  return direction < 0 ? start - kCellSize / 2 : start + size + kCellSize / 2;
}

function cellKey(
  x: number,
  z: number
): string {
  return `${Math.floor(x / kCellSize)},${Math.floor(z / kCellSize)}`;
}
