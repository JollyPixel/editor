// Import Third-party Dependencies
import * as THREE from "three";
import {
  ConvexHull,
  type Face
} from "three/addons/math/ConvexHull.js";

// Import Internal Dependencies
import { positionVersion } from "./geometryBounds.ts";
import {
  MeshContour,
  sameNumbers
} from "./meshContour.ts";

// CONSTANTS
const kFlatVolumeRatio = 1e-6;
const kToTarget = new THREE.Matrix4();
const kPlacement = new THREE.Matrix4();
const kBounds = new THREE.Box3();
const kSize = new THREE.Vector3();

interface MeshCorners {
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  version: number;
  corners: THREE.Vector3[];
}

export class GroupHull {
  #target: THREE.Object3D;
  #fingerprint: number[] = [];
  #contour: MeshContour | null = null;
  #corners = new WeakMap<THREE.BufferGeometry, MeshCorners>();

  constructor(
    target: THREE.Object3D
  ) {
    this.#target = target;
  }

  measure(
    meshes: Iterable<THREE.Mesh>
  ): MeshContour | null {
    this.#target.updateWorldMatrix(true, true);
    kToTarget.copy(this.#target.matrixWorld).invert();

    const fingerprint: number[] = [];
    for (const mesh of meshes) {
      const { geometry } = mesh;
      fingerprint.push(
        mesh.id,
        geometry.id,
        positionVersion(geometry.getAttribute("position")),
        ...kPlacement.multiplyMatrices(kToTarget, mesh.matrixWorld).elements
      );
    }
    if (!sameNumbers(fingerprint, this.#fingerprint)) {
      this.#fingerprint = fingerprint;
      this.#contour = this.#hullContour(meshes);
    }

    return this.#contour;
  }

  #hullContour(
    meshes: Iterable<THREE.Mesh>
  ): MeshContour | null {
    const points: THREE.Vector3[] = [];
    for (const mesh of meshes) {
      kPlacement.multiplyMatrices(kToTarget, mesh.matrixWorld);
      for (const corner of this.#hullCorners(mesh.geometry)) {
        points.push(corner.clone().applyMatrix4(kPlacement));
      }
    }

    const hull = new ConvexHull().setFromPoints(points);

    return isFlat(hull) ? null : new MeshContour(hullGeometry(hull));
  }

  #hullCorners(
    geometry: THREE.BufferGeometry
  ): THREE.Vector3[] {
    const position = geometry.getAttribute("position");
    const version = positionVersion(position);
    const cached = this.#corners.get(geometry);
    if (cached?.position === position && cached.version === version) {
      return cached.corners;
    }

    const points = Array.from(
      { length: position.count },
      (_, index) => new THREE.Vector3().fromBufferAttribute(position, index)
    );
    const hull = new ConvexHull().setFromPoints(points);
    const corners = isFlat(hull) ? points : [...new Set(hull.faces.flatMap(faceCorners))];
    this.#corners.set(geometry, {
      position,
      version,
      corners
    });

    return corners;
  }
}

function faceCorners(
  face: Face
): THREE.Vector3[] {
  const { edge } = face;

  return [
    edge.tail().point,
    edge.head().point,
    edge.next.head().point
  ];
}

function hullGeometry(
  hull: ConvexHull
): THREE.BufferGeometry {
  const vertices = hull.faces
    .flatMap(faceCorners)
    .flatMap((corner) => corner.toArray());

  return new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );
}

function isFlat(
  hull: ConvexHull
): boolean {
  let volume = 0;
  kBounds.makeEmpty();
  for (const face of hull.faces) {
    const [a, b, c] = faceCorners(face);
    kBounds.expandByPoint(a).expandByPoint(b).expandByPoint(c);
    volume += a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;
  }

  kBounds.getSize(kSize);
  const extent = Math.max(kSize.x, kSize.y, kSize.z);

  return Math.abs(volume) <= kFlatVolumeRatio * (extent ** 3);
}
