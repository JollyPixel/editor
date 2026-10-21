// Import Internal Dependencies
import { quadDiagonal } from "../../terrain/quadDiagonal.ts";
import { SKIRT_EDGES } from "../lod/skirtMasks.ts";

// CONSTANTS
const kGridComponents = 4;
const kInside: Outward = [0, 0];
const kMorphComponents = 4;

export interface NodeMeshData {
  /**
   * Per vertex: grid X, grid Z, then the outward direction of a skirt vertex,
   * or zero for a surface vertex.
   */
  readonly grid: Float32Array;
  /**
   * Per vertex: the grid offsets of the two vertices whose average height is
   * the coarser level's surface there; zero for vertices the coarser level
   * keeps.
   */
  readonly morph: Float32Array;
  readonly indices: Uint16Array;
}

type Outward = readonly [number, number];

export function buildGridMesh(
  resolution: number
): NodeMeshData {
  if (!Number.isInteger(resolution) || resolution < 2 || resolution % 2 !== 0) {
    throw new RangeError(`A node mesh needs an even resolution of at least 2, got ${resolution}.`);
  }

  const side = resolution + 1;
  const surfaceCount = side * side;
  const vertexCount = surfaceCount + side * 4;
  const grid = new Float32Array(vertexCount * kGridComponents);
  const morph = new Float32Array(vertexCount * kMorphComponents);
  const buffers = { grid, morph };
  const indices: number[] = [];

  for (let z = 0; z <= resolution; z++) {
    for (let x = 0; x <= resolution; x++) {
      writeVertex(buffers, z * side + x, x, z, kInside);
    }
  }

  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const x0z0 = z * side + x;
      const x1z0 = x0z0 + 1;
      const x0z1 = x0z0 + side;
      const x1z1 = x0z1 + 1;
      if (quadDiagonal(x, z) === "main") {
        indices.push(x0z0, x0z1, x1z1, x0z0, x1z1, x1z0);
      }
      else {
        indices.push(x0z0, x0z1, x1z0, x1z0, x0z1, x1z1);
      }
    }
  }

  SKIRT_EDGES.forEach(({ outward }, edgeIndex) => {
    const edge = edgeWalk(outward, resolution);
    const first = surfaceCount + edgeIndex * side;
    for (let step = 0; step <= resolution; step++) {
      const [x, z] = edge(step);
      writeVertex(buffers, first + step, x, z, outward);
    }
    for (let step = 0; step < resolution; step++) {
      const [x0, z0] = edge(step);
      const [x1, z1] = edge(step + 1);
      const top0 = z0 * side + x0;
      const top1 = z1 * side + x1;
      const bottom0 = first + step;
      const bottom1 = bottom0 + 1;
      indices.push(top0, top1, bottom0, top1, bottom1, bottom0);
    }
  });

  return {
    grid,
    morph,
    indices: Uint16Array.from(indices)
  };
}

function edgeWalk(
  [outX, outZ]: Outward,
  resolution: number
): (step: number) => [number, number] {
  const alongX = -outZ;
  const alongZ = outX;
  const startX = resolution / 2 * (1 + outX - alongX);
  const startZ = resolution / 2 * (1 + outZ - alongZ);

  return (step) => [startX + alongX * step, startZ + alongZ * step];
}

function writeVertex(
  buffers: Pick<NodeMeshData, "grid" | "morph">,
  vertex: number,
  x: number,
  z: number,
  outward: Outward
): void {
  buffers.grid.set([x, z, ...outward], vertex * kGridComponents);
  buffers.morph.set(morphOffsets(x, z), vertex * kMorphComponents);
}

function morphOffsets(
  x: number,
  z: number
): [number, number, number, number] {
  const oddX = x % 2 === 1;
  const oddZ = z % 2 === 1;
  if (oddX && oddZ) {
    return quadDiagonal((x - 1) / 2, (z - 1) / 2) === "main" ?
      [-1, -1, 1, 1] :
      [1, -1, -1, 1];
  }
  if (oddX) {
    return [-1, 0, 1, 0];
  }
  if (oddZ) {
    return [0, -1, 0, 1];
  }

  return [0, 0, 0, 0];
}
