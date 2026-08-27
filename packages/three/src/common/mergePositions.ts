// Import Third-party Dependencies
import * as THREE from "three";

/**
 * Concatenates the `position` attributes of `geometries` into one non-indexed geometry
 */
export function mergePositions(
  geometries: THREE.BufferGeometry[]
): THREE.BufferGeometry {
  const parts = geometries.map(
    (geometry) => geometry.toNonIndexed()
  );
  const total = parts.reduce(
    (count, part) => count + part.getAttribute("position").count,
    0
  );

  const positions = new Float32Array(total * 3);
  let offset = 0;
  for (const part of parts) {
    positions.set(
      part.getAttribute("position").array,
      offset
    );
    offset += part.getAttribute("position").count * 3;
    part.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );

  return merged;
}
