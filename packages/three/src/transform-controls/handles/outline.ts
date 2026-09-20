// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

// Import Internal Dependencies
import type { ResolvedOutline } from "../appearance.ts";
import {
  createOutlineMaterial,
  type FrontClip,
  OUTLINE_NORMAL_ATTRIBUTE
} from "./materials.ts";

// CONSTANTS
const kMiterLimit = 2;
const kRegularization = 0.02;
const kDegenerateArea = 1e-12;

const kCorners = [
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3()
];
const kEdgeA = new THREE.Vector3();
const kEdgeB = new THREE.Vector3();
const kFaceNormal = new THREE.Vector3();
const kMiter = new THREE.Vector3();
const kSystem = new THREE.Matrix3();

export interface HandleOutlineOptions {
  outline: ResolvedOutline;
  depthTest: boolean;
  renderOrder: number;
  clip?: FrontClip;
}

export type HandleOutlineMesh = THREE.Mesh<
  THREE.BufferGeometry,
  THREE.MeshBasicNodeMaterial
>;

export function createHandleOutline(
  geometry: THREE.BufferGeometry,
  options: HandleOutlineOptions
): HandleOutlineMesh {
  const { outline, depthTest, renderOrder, clip } = options;

  const mesh = new THREE.Mesh(
    createOutlineGeometry(geometry),
    createOutlineMaterial({
      outline,
      depthTest,
      clip
    })
  );
  mesh.name = "transform-handle-outline";
  mesh.renderOrder = renderOrder;
  mesh.frustumCulled = false;

  return mesh;
}

export function createOutlineGeometry(
  geometry: THREE.BufferGeometry
): THREE.BufferGeometry {
  const source = new THREE.BufferGeometry();
  source.setAttribute("position", geometry.getAttribute("position").clone());
  source.setIndex(geometry.getIndex()?.clone() ?? null);

  const outline = mergeVertices(source);
  source.dispose();
  outline.setAttribute(
    OUTLINE_NORMAL_ATTRIBUTE,
    new THREE.BufferAttribute(computeMiterNormals(outline), 3)
  );

  return outline;
}

function computeMiterNormals(
  geometry: THREE.BufferGeometry
): Float32Array {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const triangleCount = (index?.count ?? position.count) / 3;

  const systems = new Float64Array(position.count * 6);
  const sums = new Float64Array(position.count * 3);
  const weights = new Float64Array(position.count);

  for (let triangle = 0; triangle < triangleCount; triangle++) {
    const vertices = [0, 1, 2].map((corner) => {
      const offset = (triangle * 3) + corner;

      return index === null ? offset : index.getX(offset);
    });
    vertices.forEach(
      (vertex, corner) => kCorners[corner].fromBufferAttribute(
        position,
        vertex
      )
    );

    kEdgeA.subVectors(kCorners[1], kCorners[0]);
    kEdgeB.subVectors(kCorners[2], kCorners[0]);
    kFaceNormal.crossVectors(kEdgeA, kEdgeB);
    if (kFaceNormal.lengthSq() < kDegenerateArea) {
      continue;
    }
    kFaceNormal.normalize();

    vertices.forEach((vertex, corner) => {
      const weight = cornerAngle(corner);
      accumulate(systems, sums, vertex, weight);
      weights[vertex] += weight;
    });
  }

  const normals = new Float32Array(position.count * 3);
  for (let vertex = 0; vertex < position.count; vertex++) {
    solveMiter(systems, sums, weights[vertex], vertex);
    normals.set(kMiter.toArray(), vertex * 3);
  }

  return normals;
}

function cornerAngle(
  corner: number
): number {
  const origin = kCorners[corner];
  kEdgeA.subVectors(kCorners[(corner + 1) % 3], origin);
  kEdgeB.subVectors(kCorners[(corner + 2) % 3], origin);

  return kEdgeA.angleTo(kEdgeB);
}

function accumulate(
  systems: Float64Array,
  sums: Float64Array,
  vertex: number,
  weight: number
): void {
  const { x, y, z } = kFaceNormal;
  const system = vertex * 6;
  systems[system] += weight * x * x;
  systems[system + 1] += weight * x * y;
  systems[system + 2] += weight * x * z;
  systems[system + 3] += weight * y * y;
  systems[system + 4] += weight * y * z;
  systems[system + 5] += weight * z * z;

  const sum = vertex * 3;
  sums[sum] += weight * x;
  sums[sum + 1] += weight * y;
  sums[sum + 2] += weight * z;
}

function solveMiter(
  systems: Float64Array,
  sums: Float64Array,
  weight: number,
  vertex: number
): void {
  const sum = vertex * 3;
  kMiter.set(sums[sum], sums[sum + 1], sums[sum + 2]);
  if (weight === 0 || kMiter.lengthSq() === 0) {
    kMiter.set(0, 0, 0);

    return;
  }

  const system = vertex * 6;
  const damping = weight * kRegularization;
  kFaceNormal.copy(kMiter).normalize();
  kMiter.addScaledVector(kFaceNormal, damping);
  kSystem.set(
    systems[system] + damping,
    systems[system + 1],
    systems[system + 2],
    systems[system + 1],
    systems[system + 3] + damping,
    systems[system + 4],
    systems[system + 2],
    systems[system + 4],
    systems[system + 5] + damping
  );
  kMiter
    .applyMatrix3(kSystem.invert())
    .clampLength(0, kMiterLimit);
}
