// Import Third-party Dependencies
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// CONSTANTS
const kRadialSegments = 8;
const kCapSegments = 4;

export const BORDER_RADIUS = 0.025;

export function createEdgeBorder(
  points: THREE.Vector3[],
  edges: readonly (readonly [number, number])[],
  material: THREE.MeshBasicMaterial,
  errorMessage: string
): THREE.Mesh {
  const geometries = edges.map(([from, to]) => createBorderEdgeBetween(
    points[from],
    points[to]
  ));

  return new THREE.Mesh(
    mergeBorderGeometries(geometries, errorMessage),
    material
  );
}

export function createRoundedBoxBorder(
  size: number,
  material: THREE.MeshBasicMaterial
): THREE.Mesh {
  const halfSize = size / 2;
  const edgeLength = size - (BORDER_RADIUS * 2);
  const geometries: THREE.BufferGeometry[] = [];

  for (const x of [-halfSize, halfSize]) {
    for (const z of [-halfSize, halfSize]) {
      geometries.push(createAxisBorderEdge(
        edgeLength,
        new THREE.Vector3(x, 0, z)
      ));
    }
  }

  for (const y of [-halfSize, halfSize]) {
    for (const z of [-halfSize, halfSize]) {
      geometries.push(createAxisBorderEdge(
        edgeLength,
        new THREE.Vector3(0, y, z),
        new THREE.Euler(0, 0, Math.PI / 2)
      ));
    }
  }

  for (const x of [-halfSize, halfSize]) {
    for (const y of [-halfSize, halfSize]) {
      geometries.push(createAxisBorderEdge(
        edgeLength,
        new THREE.Vector3(x, y, 0),
        new THREE.Euler(Math.PI / 2, 0, 0)
      ));
    }
  }

  for (const x of [-halfSize, halfSize]) {
    for (const y of [-halfSize, halfSize]) {
      for (const z of [-halfSize, halfSize]) {
        const corner = new THREE.SphereGeometry(
          BORDER_RADIUS,
          kRadialSegments,
          kCapSegments * 2
        );
        corner.translate(x, y, z);
        geometries.push(corner);
      }
    }
  }

  return new THREE.Mesh(
    mergeBorderGeometries(geometries, "Unable to merge cube border geometry"),
    material
  );
}

function createBorderEdgeBetween(
  from: THREE.Vector3,
  to: THREE.Vector3
): THREE.BufferGeometry {
  const direction = to.clone().sub(from);
  const geometry = new THREE.CapsuleGeometry(
    BORDER_RADIUS,
    Math.max(0, direction.length() - (BORDER_RADIUS * 2)),
    kCapSegments,
    kRadialSegments
  );
  const transform = new THREE.Matrix4().compose(
    from.clone().add(to).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize()
    ),
    new THREE.Vector3(1, 1, 1)
  );
  geometry.applyMatrix4(transform);

  return geometry;
}

function createAxisBorderEdge(
  length: number,
  position: THREE.Vector3,
  rotation = new THREE.Euler()
): THREE.BufferGeometry {
  const geometry = new THREE.CapsuleGeometry(
    BORDER_RADIUS,
    length,
    kCapSegments,
    kRadialSegments
  );
  const transform = new THREE.Matrix4().compose(
    position,
    new THREE.Quaternion().setFromEuler(rotation),
    new THREE.Vector3(1, 1, 1)
  );
  geometry.applyMatrix4(transform);

  return geometry;
}

function mergeBorderGeometries(
  geometries: THREE.BufferGeometry[],
  errorMessage: string
): THREE.BufferGeometry {
  const geometry = mergeGeometries(geometries);
  if (geometry === null) {
    throw new Error(errorMessage);
  }

  return geometry;
}
