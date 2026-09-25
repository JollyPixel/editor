// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { ChunkGeometryKey } from "../mesh/ChunkGeometryKey.ts";

export interface MergedChunkGeometry {
  geometry: THREE.BufferGeometry;
  /**
   * True when newly allocated, meaning the caller must dispose it.
   */
  owned: boolean;
}

export function drawnIndices(
  geometry: THREE.BufferGeometry
): THREE.TypedArray | null {
  const index = geometry.getIndex();
  if (!index) {
    return null;
  }

  const { start, count } = geometry.drawRange;
  const end = Math.min(index.count, start + count);

  return index.array.subarray(Math.min(start, end), end);
}

export function mergeChunkGeometries(
  geometries: ReadonlyMap<ChunkGeometryKey, THREE.BufferGeometry>
): MergedChunkGeometry | null {
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

  let positionLength = 0;
  let indexLength = 0;
  for (const geometry of geometries.values()) {
    const position = geometry.getAttribute("position");
    const indices = drawnIndices(geometry);
    if (!position || !indices) {
      continue;
    }

    positionLength += position.array.length;
    indexLength += indices.length;
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
    const source = drawnIndices(geometry);
    if (!position || !source) {
      continue;
    }

    positions.set(position.array, positionCursor);
    positionCursor += position.array.length;
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
  merged.setIndex(
    new THREE.BufferAttribute(indices, 1)
  );

  return {
    geometry: merged,
    owned: true
  };
}
