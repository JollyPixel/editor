// Import Third-party Dependencies
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Import Internal Dependencies
import type { Axis, AxisSign } from "../../common/axes.ts";

export interface VisibleFaces {
  posX: boolean;
  negX: boolean;
  posY: boolean;
  negY: boolean;
  posZ: boolean;
  negZ: boolean;
}

export const DEFAULT_VISIBLE_FACES: VisibleFaces = {
  posX: true,
  negX: false,
  posY: true,
  negY: false,
  posZ: true,
  negZ: false
};

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

/*
 * A box's face, dropped when it sits exactly where another piece of this
 * silhouette touches it. Without this, the bar meeting a corner joint (or
 * two edges meeting a joint) each keep the face at that shared plane, and
 * those two faces are then perfectly coincident: same plane, same
 * rectangle. Opaque rendering hides it (drawing the same color over itself
 * twice looks the same as once), which is why this only ever showed up
 * under the opacity used for hover. Under alpha blending that duplicate
 * face gets composited twice, painting a visibly different square right
 * on the seam. Dropping it here is the geometric union of the two shapes:
 * there was never anything to actually see there in the first place.
 */
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

export function sameFaces(
  left: VisibleFaces,
  right: VisibleFaces
): boolean {
  return left.posX === right.posX &&
    left.negX === right.negX &&
    left.posY === right.posY &&
    left.negY === right.negY &&
    left.posZ === right.posZ &&
    left.negZ === right.negZ;
}

/*
 * Bars stop half a thickness short of each corner on every side, leaving an
 * exact thickness-cubed gap. A box joint of that same size fills it flush,
 * with no overlap and no rounding, unlike the sphere this used to be: a
 * sphere touches a square bar end only at its center, leaving visible gaps
 * at the bar's corners and a curved bulge past its flat sides.
 */
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

    // A kept edge always reaches a corner joint at both ends: see kept below.
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

export interface SilhouetteGeometryOptions {
  halfExtents: THREE.Vector3;
  faces: VisibleFaces;
  innerThickness: number;
  linewidth: number;
  innerColor: THREE.Color;
  color: THREE.Color;
}

/*
 * The inner and outer rings meet flush, by construction, with no gap and
 * no overlap: see buildRingParts. Rendering them as two separate meshes
 * meant two separate draw calls could write the exact same depth at that
 * shared seam, and once both depth-test for real (needed for the occluded
 * pass), that coincident plane z-fights pixel by pixel, worst at corners
 * where several touching faces converge. Merging both rings into one
 * geometry removes the seam as a rendering concept entirely: every
 * fragment belongs to exactly one triangle from one draw call, so there is
 * nothing left to compete over. The two rings only ever differed in color
 * (opacity has always been shared), so a vertex color carries that split
 * instead of a second mesh.
 */
export function buildSilhouetteGeometry(
  options: SilhouetteGeometryOptions
): SilhouetteGeometry {
  const { halfExtents, faces, innerThickness, linewidth, innerColor, color } = options;

  const innerParts = innerThickness > 0 ?
    buildRingParts(halfExtents, faces, innerThickness, 0) :
    [];
  const outerParts = buildRingParts(halfExtents, faces, linewidth, innerThickness);
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

  /*
   * Order matters: outerColorStart above assumes outer parts trail inner
   * ones, and writeOuterColor below only repaints that trailing slice.
   */
  const parts = [...innerParts, ...outerParts];
  const geometry = parts.length > 0 ? mergeGeometries(parts) : new THREE.BufferGeometry();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return { geometry, outerColorStart };
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

export function halfExtentsOf(
  target: THREE.Mesh
): THREE.Vector3 {
  target.geometry.computeBoundingBox();
  const box = target.geometry.boundingBox as THREE.Box3;

  return box.max.clone().sub(box.min).multiplyScalar(0.5);
}
