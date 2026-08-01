// Import Third-party Dependencies
import * as THREE from "three";

/**
 * Merges per-tileset chunk geometries into one position/index geometry.
 * Only collision-relevant attributes are kept (no UVs, normals or colors).
 *
 * Returns null when there is nothing to collide with.
 */
export function mergeChunkGeometries(
  geometries: ReadonlyMap<string, THREE.BufferGeometry>
): {
  geometry: THREE.BufferGeometry;
  /** True when newly allocated, meaning the caller must dispose it. */
  owned: boolean;
} | null {
  if (geometries.size === 0) {
    return null;
  }

  if (geometries.size === 1) {
    const [geometry] = geometries.values();

    return {
      geometry,
      owned: false
    };
  }

  const positions: number[] = [];
  const indices: number[] = [];
  let indexOffset = 0;

  for (const geometry of geometries.values()) {
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex();
    if (!position || !index) {
      continue;
    }

    for (let i = 0; i < position.array.length; i++) {
      positions.push(position.array[i]);
    }
    for (let i = 0; i < index.array.length; i++) {
      indices.push(index.array[i] + indexOffset);
    }
    indexOffset += position.count;
  }

  if (positions.length === 0) {
    return null;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  merged.setIndex(indices);

  return {
    geometry: merged,
    owned: true
  };
}
