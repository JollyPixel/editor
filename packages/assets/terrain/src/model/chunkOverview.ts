// Import Third-party Dependencies
import {
  CHUNK_SAMPLES,
  overviewSamples
} from "@jolly-pixel/terrain.renderer";

export function chunkOverview(
  heights: Float32Array
): Float32Array {
  return overviewSamples({
    height: (localX, localZ) => heights[localZ * CHUNK_SAMPLES + localX]
  });
}
