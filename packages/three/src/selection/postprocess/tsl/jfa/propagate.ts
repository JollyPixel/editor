// Import Third-party Dependencies
import { Fn, If, and, float, vec2, vec4, uv, texture, greaterThan, lessThan } from "three/tsl";

// CONSTANTS
/**
 * 9-neighbor Jump Flood sampling pattern (the 8 compass directions plus the
 * center/self offset) - a fixed, small set, so it's unrolled as plain JS
 * `for` loops building the shader graph rather than a TSL `Loop()` (same
 * "manually unroll a small fixed neighborhood" style `tsl/edgeDetection.ts`'s
 * `buildEdgeDetection` already uses for its 4-neighbor scan).
 */
export const JFA_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1]
];

/**
 * One Jump Flood propagation step for the *position* buffer: for the current
 * texel, checks the 9 neighbors (at `stepNode` texels away) of the previous
 * iteration's position buffer and keeps whichever one is nearest in pixel
 * space, carrying that neighbor's own stored seed position forward. `vec4`
 * layout: `xy` = seed's own pixel coordinate, `z` = valid flag (`1`/`0`),
 * `w` unused.
 */
export function buildJfaPositionStep(
  positionSourceTexture: ReturnType<typeof texture>,
  stepNode: ReturnType<typeof float>,
  invSizeNode: ReturnType<typeof vec2>,
  resolutionNode: ReturnType<typeof vec2>
) {
  return Fn(() => {
    const uvNode = uv();
    const pixelCoord = uvNode.mul(resolutionNode).toVar();
    const best = vec4(0, 0, 0, 0).toVar();
    const bestDist = float(1e10).toVar();

    for (const [dx, dy] of JFA_OFFSETS) {
      const sampleUv = uvNode.add(vec2(dx, dy).mul(stepNode).mul(invSizeNode));
      const candidate = positionSourceTexture.sample(sampleUv).toVar();
      const dist = pixelCoord.sub(candidate.xy).length();

      If(and(greaterThan(candidate.z, float(0.5)), lessThan(dist, bestDist)), () => {
        best.assign(candidate);
        bestDist.assign(dist);
      });
    }

    return best;
  })();
}

/**
 * The color-buffer twin of `buildJfaPositionStep` - re-derives the exact
 * same "which of the 9 neighbors is nearest" decision (same source texture,
 * same math, so it agrees with the position step's own choice - recomputing
 * it rather than packing color into the position buffer or using a
 * multi-render-target step keeps every step a plain single-output fragment
 * shader), then outputs *that* neighbor's color instead of its position.
 */
export function buildJfaColorStep(
  positionSourceTexture: ReturnType<typeof texture>,
  colorSourceTexture: ReturnType<typeof texture>,
  stepNode: ReturnType<typeof float>,
  invSizeNode: ReturnType<typeof vec2>,
  resolutionNode: ReturnType<typeof vec2>
) {
  return Fn(() => {
    const uvNode = uv();
    const pixelCoord = uvNode.mul(resolutionNode).toVar();
    const bestColor = vec4(0, 0, 0, 0).toVar();
    const bestDist = float(1e10).toVar();

    for (const [dx, dy] of JFA_OFFSETS) {
      const offset = vec2(dx, dy).mul(stepNode).mul(invSizeNode);
      const sampleUv = uvNode.add(offset);
      const candidatePos = positionSourceTexture.sample(sampleUv).toVar();
      const dist = pixelCoord.sub(candidatePos.xy).length();

      If(and(greaterThan(candidatePos.z, float(0.5)), lessThan(dist, bestDist)), () => {
        bestDist.assign(dist);
        bestColor.assign(colorSourceTexture.sample(sampleUv));
      });
    }

    return bestColor;
  })();
}
