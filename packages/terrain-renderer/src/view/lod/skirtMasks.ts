// Import Internal Dependencies
import { LEAF_NODE_SIZE } from "./LodRanges.ts";

// CONSTANTS
const kProbeOffset = LEAF_NODE_SIZE / 2 ** 8;
const kEdgeProbes = [0.125, 0.375, 0.625, 0.875];
const kKeySpan = 2 ** 24;
const kKeyOffset = kKeySpan / 2;

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
  const bySize = new Map<number, Map<number, NodeArea>>();
  for (const node of nodes) {
    let index = bySize.get(node.size);
    if (index === undefined) {
      index = new Map();
      bySize.set(node.size, index);
    }
    index.set(alignedKey(node.x, node.z, node.size), node);
  }
  const sizes = [...bySize.keys()].sort((left, right) => left - right);
  function nodeAt(
    x: number,
    z: number
  ): NodeArea | undefined {
    for (const size of sizes) {
      const node = bySize.get(size)!.get(alignedKey(x, z, size));
      if (node !== undefined) {
        return node;
      }
    }

    return undefined;
  }

  return nodes.map((node) => {
    let mask = 0;
    for (const { bit, outward: [outX, outZ] } of SKIRT_EDGES) {
      const differs = kEdgeProbes.some((along) => {
        const x = outX === 0 ? node.x + along * node.size : edgeOutside(node.x, node.size, outX);
        const z = outZ === 0 ? node.z + along * node.size : edgeOutside(node.z, node.size, outZ);
        const neighbour = nodeAt(x, z);

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
  return direction < 0 ? start - kProbeOffset : start + size + kProbeOffset;
}

function alignedKey(
  x: number,
  z: number,
  size: number
): number {
  return (Math.floor(x / size) + kKeyOffset) * kKeySpan + Math.floor(z / size) + kKeyOffset;
}
