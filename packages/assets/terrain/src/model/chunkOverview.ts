// Import Third-party Dependencies
import {
  chunkResolution,
  overviewSamples,
  tierOfSampleCount
} from "@jolly-pixel/terrain.renderer";

export function chunkOverview(
  heights: Float32Array
): Float32Array {
  const tier = tierOfSampleCount(heights.length) ?? 1;
  const resolution = chunkResolution(tier);

  return overviewSamples({
    height: (localX, localZ) => heights[localZ * tier * resolution + localX * tier]
  });
}
