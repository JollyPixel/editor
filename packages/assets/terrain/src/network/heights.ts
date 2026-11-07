// Import Third-party Dependencies
import {
  CHUNK_SAMPLE_COUNT,
  chunkSampleCount,
  isValidHeight,
  tierOfSampleCount
} from "@jolly-pixel/terrain.renderer";

// CONSTANTS
const kBytesPerHeight = Float32Array.BYTES_PER_ELEMENT;

export function encodeHeightBytes(
  heights: Float32Array
): Uint8Array {
  const bytes = new Uint8Array(heights.length * kBytesPerHeight);
  const view = new DataView(bytes.buffer);
  heights.forEach((height, index) => {
    view.setFloat32(index * kBytesPerHeight, height, true);
  });

  return bytes;
}

export function decodeHeightBytes(
  bytes: Uint8Array,
  count: number = CHUNK_SAMPLE_COUNT
): Float32Array | null {
  if (bytes.byteLength !== count * kBytesPerHeight) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const heights = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    heights[index] = view.getFloat32(index * kBytesPerHeight, true);
  }

  return heights.every(isValidHeight) ? heights : null;
}

export function decodeChunkHeightBytes(
  bytes: Uint8Array
): Float32Array | null {
  const tier = tierOfSampleCount(bytes.byteLength / kBytesPerHeight);

  return tier === null ? null : decodeHeightBytes(bytes, chunkSampleCount(tier));
}
