// Import Third-party Dependencies
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Import Internal Dependencies
import type { Axis, AxisSign } from "../../common/math/axes.ts";

export interface VisibleFaces {
  posX: boolean;
  negX: boolean;
  posY: boolean;
  negY: boolean;
  posZ: boolean;
  negZ: boolean;
}

const kAxisIndex: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

interface EdgeBarEntry {
  axis: Axis;
  cross1: Axis;
  cross2: Axis;
  sCross1: AxisSign;
  sCross2: AxisSign;
}

const kEdgeBars: readonly EdgeBarEntry[] = [
  { axis: "x", cross1: "y", cross2: "z", sCross1: 1, sCross2: 1 },
  { axis: "x", cross1: "y", cross2: "z", sCross1: 1, sCross2: -1 },
  { axis: "x", cross1: "y", cross2: "z", sCross1: -1, sCross2: 1 },
  { axis: "x", cross1: "y", cross2: "z", sCross1: -1, sCross2: -1 },
  { axis: "y", cross1: "x", cross2: "z", sCross1: 1, sCross2: 1 },
  { axis: "y", cross1: "x", cross2: "z", sCross1: 1, sCross2: -1 },
  { axis: "y", cross1: "x", cross2: "z", sCross1: -1, sCross2: 1 },
  { axis: "y", cross1: "x", cross2: "z", sCross1: -1, sCross2: -1 },
  { axis: "z", cross1: "x", cross2: "y", sCross1: 1, sCross2: 1 },
  { axis: "z", cross1: "x", cross2: "y", sCross1: 1, sCross2: -1 },
  { axis: "z", cross1: "x", cross2: "y", sCross1: -1, sCross2: 1 },
  { axis: "z", cross1: "x", cross2: "y", sCross1: -1, sCross2: -1 }
];

const kCornerSigns: ReadonlyArray<readonly [AxisSign, AxisSign, AxisSign]> = [
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
  [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]
];

type BoxFace = "posX" | "negX" | "posY" | "negY" | "posZ" | "negZ";

interface EdgeKeptAtCorner {
  x: boolean;
  y: boolean;
  z: boolean;
}

const kBoxFaceOrder: readonly BoxFace[] = ["posX", "negX", "posY", "negY", "posZ", "negZ"];
const kPosFace: Record<Axis, BoxFace> = { x: "posX", y: "posY", z: "posZ" };
const kNegFace: Record<Axis, BoxFace> = { x: "negX", y: "negY", z: "negZ" };

function buildBoxGeometry(
  size: readonly [number, number, number],
  excludeFaces: ReadonlySet<BoxFace>
): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(...size);
  if (excludeFaces.size === 0) {
    return box;
  }

  const sourceIndex = box.getIndex() as THREE.BufferAttribute;
  const keptIndices: number[] = [];
  for (const group of box.groups) {
    if (excludeFaces.has(kBoxFaceOrder[group.materialIndex ?? 0])) {
      continue;
    }
    for (let index = group.start; index < group.start + group.count; index++) {
      keptIndices.push(sourceIndex.getX(index));
    }
  }
  box.setIndex(keptIndices);
  box.clearGroups();

  return box;
}

function faceValue(
  faces: VisibleFaces,
  axis: Axis,
  sign: AxisSign
): boolean {
  if (axis === "x") {
    return sign === 1 ? faces.posX : faces.negX;
  }
  if (axis === "y") {
    return sign === 1 ? faces.posY : faces.negY;
  }

  return sign === 1 ? faces.posZ : faces.negZ;
}

export function computeVisibleFaces(
  localCameraPosition: THREE.Vector3,
  halfExtents: THREE.Vector3
): VisibleFaces {
  return {
    posX: localCameraPosition.x > halfExtents.x,
    negX: localCameraPosition.x < -halfExtents.x,
    posY: localCameraPosition.y > halfExtents.y,
    negY: localCameraPosition.y < -halfExtents.y,
    posZ: localCameraPosition.z > halfExtents.z,
    negZ: localCameraPosition.z < -halfExtents.z
  };
}

function buildRingParts(
  halfExtents: THREE.Vector3,
  faces: VisibleFaces,
  thickness: number,
  offset: number
): THREE.BufferGeometry[] {
  const nearSurfaceOffset = offset + (thickness / 2);
  const offsets: Record<Axis, number> = {
    x: halfExtents.x + nearSurfaceOffset,
    y: halfExtents.y + nearSurfaceOffset,
    z: halfExtents.z + nearSurfaceOffset
  };
  const parts: THREE.BufferGeometry[] = [];

  function pushBar(
    entry: EdgeBarEntry,
    faceCross1Value: boolean,
    faceCross2Value: boolean
  ): void {
    if (faceCross1Value === faceCross2Value) {
      return;
    }

    const { axis, cross1, cross2, sCross1, sCross2 } = entry;
    const size: [number, number, number] = [thickness, thickness, thickness];
    size[kAxisIndex[axis]] = 2 * (offsets[axis] - (thickness / 2));
    const center: [number, number, number] = [0, 0, 0];
    center[kAxisIndex[cross1]] = sCross1 * offsets[cross1];
    center[kAxisIndex[cross2]] = sCross2 * offsets[cross2];

    const bar = buildBoxGeometry(size, new Set([kPosFace[axis], kNegFace[axis]]));
    bar.translate(...center);
    parts.push(bar);
  }

  function pushCornerJoint(
    corner: readonly [AxisSign, AxisSign, AxisSign],
    kept: EdgeKeptAtCorner
  ): void {
    const [sx, sy, sz] = corner;
    const excludeFaces = new Set<BoxFace>();
    if (kept.x) {
      excludeFaces.add(sx === 1 ? kNegFace.x : kPosFace.x);
    }
    if (kept.y) {
      excludeFaces.add(sy === 1 ? kNegFace.y : kPosFace.y);
    }
    if (kept.z) {
      excludeFaces.add(sz === 1 ? kNegFace.z : kPosFace.z);
    }

    const joint = buildBoxGeometry([thickness, thickness, thickness], excludeFaces);
    joint.translate(sx * offsets.x, sy * offsets.y, sz * offsets.z);
    parts.push(joint);
  }

  for (const entry of kEdgeBars) {
    pushBar(
      entry,
      faceValue(faces, entry.cross1, entry.sCross1),
      faceValue(faces, entry.cross2, entry.sCross2)
    );
  }

  for (const corner of kCornerSigns) {
    const [sx, sy, sz] = corner;
    const u = faceValue(faces, "x", sx);
    const v = faceValue(faces, "y", sy);
    const w = faceValue(faces, "z", sz);
    const kept: EdgeKeptAtCorner = { x: v !== w, y: u !== w, z: u !== v };
    const keptCount = (kept.x ? 1 : 0) + (kept.y ? 1 : 0) + (kept.z ? 1 : 0);
    if (keptCount === 2) {
      pushCornerJoint(corner, kept);
    }
  }

  return parts;
}

function tagColor(
  geometry: THREE.BufferGeometry,
  color: THREE.Color
): THREE.BufferGeometry {
  const count = geometry.getAttribute("position").count;
  const values = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    values[(index * 3)] = color.r;
    values[(index * 3) + 1] = color.g;
    values[(index * 3) + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));

  return geometry;
}

export interface SilhouetteGeometry {
  geometry: THREE.BufferGeometry;
  outerColorStart: number;
}

export interface SilhouetteRings {
  innerThickness: number;
  linewidth: number;
  innerColor: THREE.Color;
  color: THREE.Color;
}

export interface SilhouetteGeometryOptions extends SilhouetteRings {
  halfExtents: THREE.Vector3;
  faces: VisibleFaces;
}

export function mergeRings(
  innerParts: THREE.BufferGeometry[],
  outerParts: THREE.BufferGeometry[],
  rings: SilhouetteRings
): SilhouetteGeometry {
  const { innerColor, color } = rings;
  const outerColorStart = innerParts.reduce(
    (count, part) => count + part.getAttribute("position").count,
    0
  );

  for (const part of innerParts) {
    tagColor(part, innerColor);
  }
  for (const part of outerParts) {
    tagColor(part, color);
  }

  const parts = [...innerParts, ...outerParts];
  const geometry = parts.length > 0 ? mergeGeometries(parts) : emptySilhouetteGeometry();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return { geometry, outerColorStart };
}

export function buildSilhouetteGeometry(
  options: SilhouetteGeometryOptions
): SilhouetteGeometry {
  const { halfExtents, faces, innerThickness, linewidth } = options;

  const innerParts = innerThickness > 0 ?
    buildRingParts(halfExtents, faces, innerThickness, 0) :
    [];
  const outerParts = buildRingParts(halfExtents, faces, linewidth, innerThickness);

  return mergeRings(innerParts, outerParts, options);
}

function emptySilhouetteGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(0), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(0), 3));

  return geometry;
}

export function writeOuterColor(
  geometry: THREE.BufferGeometry,
  outerColorStart: number,
  color: THREE.Color
): void {
  const attribute = geometry.getAttribute("color") as THREE.BufferAttribute;
  for (let index = outerColorStart; index < attribute.count; index++) {
    attribute.setXYZ(index, color.r, color.g, color.b);
  }
  attribute.needsUpdate = true;
}

export function measureHalfExtents(
  target: THREE.Mesh
): THREE.Vector3 {
  target.geometry.computeBoundingBox();
  const box = target.geometry.boundingBox as THREE.Box3;

  return box.max.clone().sub(box.min).multiplyScalar(0.5);
}
