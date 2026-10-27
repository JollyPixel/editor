// Import Third-party Dependencies
import {
  CHUNK_SAMPLE_COUNT,
  isValidHeight
} from "@jolly-pixel/terrain.renderer";
import {
  decodeBase64,
  encodeBase64
} from "@jolly-pixel/asset.common";

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

export function encodeHeights(
  heights: Float32Array
): string {
  return encodeBase64(encodeHeightBytes(heights));
}

export function decodeHeights(
  encoded: string,
  count: number = CHUNK_SAMPLE_COUNT
): Float32Array | null {
  const bytes = decodeBase64(encoded);

  return bytes === null ? null : decodeHeightBytes(bytes, count);
}
