// Import Third-party Dependencies
import {
  CHUNK_SAMPLE_COUNT,
  isValidHeight
} from "@jolly-pixel/terrain.renderer";

// CONSTANTS
const kBytesPerHeight = Float32Array.BYTES_PER_ELEMENT;
const kBinaryBatch = 0x8000;

export function encodeHeights(
  heights: Float32Array
): string {
  const bytes = new Uint8Array(heights.length * kBytesPerHeight);
  const view = new DataView(bytes.buffer);
  heights.forEach((height, index) => {
    view.setFloat32(index * kBytesPerHeight, height, true);
  });

  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += kBinaryBatch) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + kBinaryBatch));
  }

  return btoa(binary);
}

export function decodeHeights(
  encoded: string,
  count: number = CHUNK_SAMPLE_COUNT
): Float32Array | null {
  let binary: string;
  try {
    binary = atob(encoded);
  }
  catch {
    return null;
  }
  const byteLength = count * kBytesPerHeight;
  if (binary.length !== byteLength) {
    return null;
  }

  const view = new DataView(new ArrayBuffer(byteLength));
  for (let index = 0; index < byteLength; index++) {
    view.setUint8(index, binary.charCodeAt(index));
  }
  const heights = new Float32Array(count);
  for (let index = 0; index < count; index++) {
    heights[index] = view.getFloat32(index * kBytesPerHeight, true);
  }

  return heights.every(isValidHeight) ? heights : null;
}
