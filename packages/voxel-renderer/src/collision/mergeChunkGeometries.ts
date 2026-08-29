// Import Third-party Dependencies
import * as THREE from "three";

/**
 * Merges chunk geometries, retaining only positions and indices.
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

  // Sizing the output up front keeps this to two allocations instead of the
  // repeated reallocation (and boxed doubles) a `number[]` would cost.
  let positionLength = 0;
  let indexLength = 0;
  for (const geometry of geometries.values()) {
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex();
    if (!position || !index) {
      continue;
    }

    positionLength += position.array.length;
    indexLength += index.array.length;
  }

  if (positionLength === 0) {
    return null;
  }

  const positions = new Float32Array(positionLength);
  const indices = new Uint32Array(indexLength);
  let positionCursor = 0;
  let indexCursor = 0;
  let indexOffset = 0;

  for (const geometry of geometries.values()) {
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex();
    if (!position || !index) {
      continue;
    }

    positions.set(position.array, positionCursor);
    positionCursor += position.array.length;

    // Indices are rebased onto the merged vertex range, so they cannot be
    // copied verbatim the way positions can.
    const source = index.array;
    for (let i = 0; i < source.length; i++) {
      indices[indexCursor + i] = source[i] + indexOffset;
    }
    indexCursor += source.length;
    indexOffset += position.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );
  merged.setIndex(new THREE.BufferAttribute(indices, 1));

  return {
    geometry: merged,
    owned: true
  };
}
