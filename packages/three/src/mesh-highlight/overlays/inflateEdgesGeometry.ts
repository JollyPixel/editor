// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kPositionKeyPrecision = 5;

export function inflateEdgesGeometry(
  geometry: THREE.BufferGeometry,
  offset: number
): THREE.BufferGeometry {
  const edges = new THREE.EdgesGeometry(geometry);
  if (offset === 0) {
    return edges;
  }

  const normalByPosition = averagedNormalsByPosition(geometry);
  const position = edges.getAttribute("position");
  const normal = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    const key = positionKey(
      position.getX(i),
      position.getY(i),
      position.getZ(i)
    );
    const averaged = normalByPosition.get(key);
    if (!averaged) {
      continue;
    }

    normal.copy(averaged).normalize();
    position.setXYZ(
      i,
      position.getX(i) + (normal.x * offset),
      position.getY(i) + (normal.y * offset),
      position.getZ(i) + (normal.z * offset)
    );
  }
  position.needsUpdate = true;

  return edges;
}

function averagedNormalsByPosition(
  geometry: THREE.BufferGeometry
): Map<string, THREE.Vector3> {
  let position = geometry.getAttribute("position");
  let normal = geometry.getAttribute("normal");

  if (!normal) {
    const withNormals = geometry.clone();
    withNormals.computeVertexNormals();
    position = withNormals.getAttribute("position");
    normal = withNormals.getAttribute("normal");
  }

  const normalByPosition = new Map<string, THREE.Vector3>();
  for (let i = 0; i < position.count; i++) {
    const key = positionKey(
      position.getX(i),
      position.getY(i),
      position.getZ(i)
    );
    const vertexNormal = new THREE.Vector3(
      normal.getX(i),
      normal.getY(i),
      normal.getZ(i)
    );

    const existing = normalByPosition.get(key);
    if (existing) {
      existing.add(vertexNormal);
    }
    else {
      normalByPosition.set(
        key,
        vertexNormal
      );
    }
  }

  return normalByPosition;
}

function positionKey(
  x: number,
  y: number,
  z: number
): string {
  const xStr = x.toFixed(kPositionKeyPrecision);
  const yStr = y.toFixed(kPositionKeyPrecision);
  const zStr = z.toFixed(kPositionKeyPrecision);

  return `${xStr},${yStr},${zStr}`;
}
