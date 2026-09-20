// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  ShellPoint,
  VoxelShell
} from "./voxelShell.ts";

export interface VoxelSolid {
  min: Vec3;
  span: Vec3;
  cells: Uint8Array;
}

type Vec3 = [number, number, number];

// CONSTANTS
const kAxes = [0, 1, 2] as const;
const kNudge = 1e-3;
const kSamples = 4;
const kBisections = 8;

export function voxelSolid(
  cells: Iterable<VoxelCoord>
): VoxelSolid {
  const list = [...cells].map<Vec3>((cell) => [cell.x, cell.y, cell.z]);
  const min: Vec3 = [0, 0, 0];
  const span: Vec3 = [0, 0, 0];
  for (const axis of kAxes) {
    const values = list.map((cell) => cell[axis]);
    min[axis] = Math.min(...values);
    span[axis] = Math.max(...values) - min[axis] + 1;
  }

  const solid: VoxelSolid = {
    min,
    span,
    cells: new Uint8Array(span[0] * span[1] * span[2])
  };
  for (const cell of list) {
    solid.cells[indexOf(solid, cell)] = 1;
  }

  return solid;
}

export function contourEdges(
  shell: VoxelShell,
  solid: VoxelSolid,
  eye: ShellPoint
): number[] {
  const contour: number[] = [];
  for (let index = 0; index < shell.edgeFaces.length; index++) {
    contour.push(...openRuns(shell, index, solid, eye));
  }

  return contour;
}

function openRuns(
  shell: VoxelShell,
  index: number,
  solid: VoxelSolid,
  eye: ShellPoint
): number[] {
  const { edges, edgeFaces } = shell;
  const offset = index * 6;
  const head = pointAt(edges, offset);
  const outward = outwardOf(edgeFaces[index], head, eye);
  if (outward === null) {
    return [];
  }

  const axis = kAxes.find(
    (candidate) => edges[offset + 3 + candidate] !== head[candidate]
  ) ?? 0;
  const end = edges[offset + 3 + axis];
  const steps = (end - head[axis]) * kSamples;
  const target: Vec3 = [
    head[0] + outward[0],
    head[1] + outward[1],
    head[2] + outward[2]
  ];
  function isOpen(
    at: number
  ): boolean {
    target[axis] = at;

    return !crosses(solid, eye, target);
  }

  const runs: number[] = [];
  let from: number | null = null;
  for (let step = 0; step <= steps; step++) {
    const at = head[axis] + ((step + 0.5) / kSamples);
    const open = step < steps && isOpen(at);
    const previous = at - (1 / kSamples);

    if (open && from === null) {
      from = step === 0 ?
        head[axis] :
        boundaryBetween(previous, at, isOpen);
    }
    if (!open && from !== null) {
      const start: Vec3 = [...head];
      const stop: Vec3 = [...head];
      start[axis] = from;
      stop[axis] = step === steps ?
        end :
        boundaryBetween(at, previous, isOpen);
      runs.push(...start, ...stop);
      from = null;
    }
  }

  return runs;
}

function pointAt(
  values: number[],
  offset: number
): Vec3 {
  return [values[offset], values[offset + 1], values[offset + 2]];
}

function boundaryBetween(
  closed: number,
  open: number,
  isOpen: (at: number) => boolean
): number {
  let hidden = closed;
  let shown = open;
  for (let pass = 0; pass < kBisections; pass++) {
    const middle = (hidden + shown) / 2;
    if (isOpen(middle)) {
      shown = middle;
    }
    else {
      hidden = middle;
    }
  }

  return shown;
}

function outwardOf(
  faces: number,
  point: Vec3,
  eye: ShellPoint
): Vec3 | null {
  const outward: Vec3 = [0, 0, 0];
  let total = 0;
  let facing = 0;

  for (let normal = 0; normal < 6; normal++) {
    if ((faces & (1 << normal)) === 0) {
      continue;
    }

    const axis = normal >> 1;
    const sign = (normal & 1) === 1 ? 1 : -1;
    outward[axis] += sign * kNudge;
    total++;
    if ((eye[axis] - point[axis]) * sign > 0) {
      facing++;
    }
  }

  return total === 2 && facing === 1 ? outward : null;
}

function crosses(
  solid: VoxelSolid,
  eye: ShellPoint,
  target: Vec3
): boolean {
  const { min, span } = solid;
  const direction = kAxes.map((axis) => target[axis] - eye[axis]);
  let enter = 0;
  let exit = Infinity;

  for (const axis of kAxes) {
    const low = min[axis] - eye[axis];
    const high = low + span[axis];
    if (direction[axis] === 0) {
      if (low > 0 || high < 0) {
        return false;
      }
      continue;
    }

    const near = low / direction[axis];
    const far = high / direction[axis];
    enter = Math.max(enter, Math.min(near, far));
    exit = Math.min(exit, Math.max(near, far));
  }
  if (enter > exit) {
    return false;
  }

  const cell: Vec3 = [0, 0, 0];
  const step: Vec3 = [0, 0, 0];
  const next: Vec3 = [Infinity, Infinity, Infinity];
  for (const axis of kAxes) {
    const entry = eye[axis] + (direction[axis] * enter);
    cell[axis] = Math.min(
      Math.max(Math.floor(entry), min[axis]),
      min[axis] + span[axis] - 1
    );
    step[axis] = Math.sign(direction[axis]);
    if (step[axis] !== 0) {
      const wall = cell[axis] + (step[axis] > 0 ? 1 : 0);
      next[axis] = (wall - eye[axis]) / direction[axis];
    }
  }

  while (kAxes.every(
    (axis) => cell[axis] >= min[axis] && cell[axis] < min[axis] + span[axis]
  )) {
    if (solid.cells[indexOf(solid, cell)] === 1) {
      return true;
    }

    const axis = kAxes.reduce(
      (best, candidate) => (next[candidate] < next[best] ? candidate : best)
    );
    cell[axis] += step[axis];
    next[axis] += Math.abs(1 / direction[axis]);
  }

  return false;
}

function indexOf(
  solid: VoxelSolid,
  cell: Vec3
): number {
  const { min, span } = solid;

  return (cell[0] - min[0]) +
    (span[0] * ((cell[1] - min[1]) + (span[1] * (cell[2] - min[2]))));
}
