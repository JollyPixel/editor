// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

export interface VoxelShell {
  triangles: number[];
  edges: number[];
}

type Vec3 = [number, number, number];

interface Face {
  cell: Vec3;
  axis: number;
  sign: number;
  plane: number;
}

interface EdgeFaces {
  axis: number;
  start: Vec3;
  normals: number[];
}

interface EdgeRun {
  axis: number;
  fixed: Vec3;
  starts: number[];
}

// CONSTANTS
const kDirections = [0, 1, 2].flatMap((axis) => [
  {
    axis,
    sign: -1
  },
  {
    axis,
    sign: 1
  }
]);

export function voxelShell(
  cells: Iterable<VoxelCoord>
): VoxelShell {
  const occupied = new Set<string>();
  const list: Vec3[] = [];
  for (const cell of cells) {
    const key = keyOf(cell.x, cell.y, cell.z);
    if (occupied.has(key)) {
      continue;
    }

    occupied.add(key);
    list.push([cell.x, cell.y, cell.z]);
  }

  const triangles: number[] = [];
  const edgeFaces = new Map<string, EdgeFaces>();

  for (const cell of list) {
    for (const { axis, sign } of kDirections) {
      const neighbour: Vec3 = [...cell];
      neighbour[axis] += sign;
      if (occupied.has(keyOf(...neighbour))) {
        continue;
      }

      const normal = (axis * 2) + (sign > 0 ? 1 : 0);
      const a = (axis + 1) % 3;
      const b = (axis + 2) % 3;
      const plane = cell[axis] + (sign > 0 ? 1 : 0);

      pushQuad(triangles, {
        cell,
        axis,
        sign,
        plane
      });

      for (const offset of [0, 1]) {
        const alongA: Vec3 = [...cell];
        alongA[axis] = plane;
        alongA[b] += offset;
        collectEdge(edgeFaces, a, alongA, normal);

        const alongB: Vec3 = [...cell];
        alongB[axis] = plane;
        alongB[a] += offset;
        collectEdge(edgeFaces, b, alongB, normal);
      }
    }
  }

  return {
    triangles,
    edges: mergeCreases(edgeFaces)
  };
}

function pushQuad(
  triangles: number[],
  face: Face
): void {
  const { sign } = face;
  function corner(
    u: number,
    v: number
  ): Vec3 {
    const point: Vec3 = [...face.cell];
    point[face.axis] = face.plane;
    point[(face.axis + 1) % 3] += u;
    point[(face.axis + 2) % 3] += v;

    return point;
  }
  const quad = sign > 0 ?
    [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)] :
    [corner(0, 0), corner(0, 1), corner(1, 1), corner(1, 0)];

  for (const index of [0, 1, 2, 0, 2, 3]) {
    triangles.push(...quad[index]);
  }
}

function collectEdge(
  edgeFaces: Map<string, EdgeFaces>,
  axis: number,
  start: Vec3,
  normal: number
): void {
  const key = `${axis}:${keyOf(...start)}`;
  const edge = edgeFaces.get(key);
  if (edge === undefined) {
    edgeFaces.set(key, {
      axis,
      start,
      normals: [normal]
    });
  }
  else {
    edge.normals.push(normal);
  }
}

function mergeCreases(
  edgeFaces: Map<string, EdgeFaces>
): number[] {
  const runs = new Map<string, EdgeRun>();

  for (const { axis, start, normals } of edgeFaces.values()) {
    if (normals.length === 2 && normals[0] === normals[1]) {
      continue;
    }

    const fixed: Vec3 = [...start];
    fixed[axis] = 0;

    const runKey = `${axis}:${keyOf(...fixed)}`;
    const run = runs.get(runKey);
    if (run === undefined) {
      runs.set(runKey, {
        axis,
        fixed,
        starts: [start[axis]]
      });
    }
    else {
      run.starts.push(start[axis]);
    }
  }

  const edges: number[] = [];
  for (const { axis, fixed, starts } of runs.values()) {
    starts.sort((left, right) => left - right);

    let from = starts[0];
    let to = from + 1;
    for (let index = 1; index <= starts.length; index++) {
      const next = starts[index];
      if (next === to) {
        to++;
        continue;
      }

      const head: Vec3 = [...fixed];
      const tail: Vec3 = [...fixed];
      head[axis] = from;
      tail[axis] = to;
      edges.push(...head, ...tail);

      from = next;
      to = next + 1;
    }
  }

  return edges;
}

function keyOf(
  x: number,
  y: number,
  z: number
): string {
  return `${x},${y},${z}`;
}
