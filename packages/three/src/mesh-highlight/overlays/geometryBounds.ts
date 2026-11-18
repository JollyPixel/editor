// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kScanned = new WeakMap<THREE.BufferGeometry, ScannedPositions>();

type PositionAttribute =
  | THREE.BufferAttribute
  | THREE.InterleavedBufferAttribute;

interface ScannedPositions {
  position: PositionAttribute | undefined;
  version: number;
}

export function positionVersion(
  position: PositionAttribute
): number {
  return "version" in position ? position.version : position.data.version;
}

export function geometryBounds(
  geometry: THREE.BufferGeometry
): THREE.Box3 {
  const position: PositionAttribute | undefined = geometry.getAttribute("position");
  const version = position === undefined ? 0 : positionVersion(position);
  const scanned = kScanned.get(geometry);
  if (
    geometry.boundingBox === null ||
    scanned?.position !== position ||
    scanned.version !== version
  ) {
    geometry.computeBoundingBox();
    kScanned.set(geometry, {
      position,
      version
    });
  }

  return geometry.boundingBox!;
}
