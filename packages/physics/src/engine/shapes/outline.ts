// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  ColliderDesc,
  ColliderShape
} from "../../ColliderShape.ts";
import type { Vector3Like } from "../../vectors.ts";

// CONSTANTS
const kCircleSegments = 32;
const kFullTurn = Math.PI * 2;
const kHalfTurn = Math.PI;

type Axis = "x" | "y" | "z";

interface Arc {
  center: THREE.Vector3;
  radius: number;
  axes: readonly [Axis, Axis];
  from: number;
  to: number;
}

export function outlineGeometry(
  collider: ColliderDesc
): THREE.BufferGeometry {
  const points: number[] = [];
  outlineShape(points, collider.shape);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points, 3)
  );
  if (collider.rotation !== undefined) {
    const { x, y, z, w } = collider.rotation;
    geometry.applyQuaternion(
      new THREE.Quaternion(x, y, z, w)
    );
  }
  if (collider.offset !== undefined) {
    const { x, y, z } = collider.offset;
    geometry.translate(x, y, z);
  }

  return geometry;
}

function outlineShape(
  points: number[],
  shape: ColliderShape
): void {
  switch (shape.type) {
    case "box":
      outlineBox(points, shape.halfExtents);
      break;
    case "sphere":
      outlineSphere(points, shape.radius);
      break;
    case "capsule":
      outlineCapsule(points, shape.halfHeight, shape.radius);
      break;
    case "trimesh":
      outlineTriangles(points, shape.vertices, shape.indices);
      break;
    default:
      shape satisfies never;
  }
}

function outlineBox(
  points: number[],
  half: Vector3Like
): void {
  const corners = [-1, 1].flatMap((x) => [-1, 1].flatMap(
    (y) => [-1, 1].map(
      (z) => new THREE.Vector3(x * half.x, y * half.y, z * half.z)
    )
  ));
  for (let index = 0; index < corners.length; index++) {
    for (const bit of [1, 2, 4]) {
      if ((index & bit) === 0) {
        pushSegment(
          points,
          corners[index],
          corners[index | bit]
        );
      }
    }
  }
}

function outlineSphere(
  points: number[],
  radius: number
): void {
  const center = new THREE.Vector3();
  for (const axes of [["x", "y"], ["x", "z"], ["y", "z"]] as const) {
    pushArc(points, {
      center,
      radius,
      axes,
      from: 0,
      to: kFullTurn
    });
  }
}

function outlineCapsule(
  points: number[],
  halfHeight: number,
  radius: number
): void {
  const top = new THREE.Vector3(0, halfHeight, 0);
  const bottom = new THREE.Vector3(0, -halfHeight, 0);
  for (const center of [top, bottom]) {
    pushArc(points, {
      center,
      radius,
      axes: ["x", "z"],
      from: 0,
      to: kFullTurn
    });
  }
  for (const side of ["x", "z"] as const) {
    pushArc(points, {
      center: top,
      radius,
      axes: [side, "y"],
      from: 0,
      to: kHalfTurn
    });
    pushArc(points, {
      center: bottom,
      radius,
      axes: [side, "y"],
      from: kHalfTurn,
      to: kFullTurn
    });
    for (const sign of [-1, 1]) {
      const rim = new THREE.Vector3().setComponent(
        side === "x" ? 0 : 2,
        sign * radius
      );
      pushSegment(
        points,
        rim.clone().add(top),
        rim.clone().add(bottom)
      );
    }
  }
}

function outlineTriangles(
  points: number[],
  vertices: Float32Array,
  indices: Uint32Array
): void {
  const corners = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3()
  ];
  for (let offset = 0; offset + 2 < indices.length; offset += 3) {
    for (let corner = 0; corner < 3; corner++) {
      corners[corner].fromArray(
        vertices,
        indices[offset + corner] * 3
      );
    }
    pushSegment(points, corners[0], corners[1]);
    pushSegment(points, corners[1], corners[2]);
    pushSegment(points, corners[2], corners[0]);
  }
}

function pushArc(
  points: number[],
  arc: Arc
): void {
  const [first, second] = arc.axes;
  const steps = Math.max(
    1,
    Math.round(kCircleSegments * (arc.to - arc.from) / kFullTurn)
  );
  const previous = new THREE.Vector3();
  const next = new THREE.Vector3();
  for (let step = 0; step <= steps; step++) {
    const angle = arc.from + (arc.to - arc.from) * step / steps;
    next.copy(arc.center);
    next[first] += Math.cos(angle) * arc.radius;
    next[second] += Math.sin(angle) * arc.radius;
    if (step > 0) {
      pushSegment(points, previous, next);
    }
    previous.copy(next);
  }
}

function pushSegment(
  points: number[],
  start: THREE.Vector3,
  end: THREE.Vector3
): void {
  points.push(
    start.x,
    start.y,
    start.z,
    end.x,
    end.y,
    end.z
  );
}
