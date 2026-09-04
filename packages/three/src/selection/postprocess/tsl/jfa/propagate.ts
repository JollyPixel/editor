// Import Third-party Dependencies
import { mrt, select, and, float, vec2, vec4, uv, texture, greaterThan, lessThan } from "three/tsl";

// Import Internal Dependencies
import type { TslNode } from "../tslNode.ts";

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
 * One Jump Flood propagation step, for *both* the position and color
 * buffers at once via an MRT output: checks the 9 neighbors (at
 * `stepNode` texels away) of the previous iteration's position buffer,
 * keeps whichever is nearest in pixel space, and carries that neighbor's
 * seed position *and* color forward together - one 9-neighbor scan and one
 * "nearest" decision, instead of position and color each separately
 * recomputing it (an earlier two-single-output-function version of this
 * measured 78 propagation draws for a single hovered peer selection at 13
 * JFA steps). Position `vec4` layout: `xy` = seed's own pixel coordinate,
 * `z` = valid flag (`1`/`0`), `w` unused.
 *
 * Deliberately *not* wrapped in `Fn(() => {...})()` - confirmed live that a
 * `mrt(...)` returned from inside a `Fn()` call silently reads back as
 * all-zero on every output, with no compile error; `mrt(...)` only works
 * correctly as the material's `fragmentNode` directly. The 9-neighbor scan
 * below is a chain of plain JS `let` reassignments to fresh `select()`
 * expressions, not `.toVar()`/`.assign()` mutation, so it never needed
 * `Fn()`'s imperative-statement stack.
 */
export function buildJfaPropagateStep(
  positionSourceTexture: ReturnType<typeof texture>,
  colorSourceTexture: ReturnType<typeof texture>,
  stepNode: TslNode<"float">,
  invSizeNode: TslNode<"vec2">,
  resolutionNode: TslNode<"vec2">
) {
  const uvNode = uv();
  const pixelCoord = uvNode.mul(resolutionNode);

  let bestPosition: TslNode<"vec4"> = vec4(0, 0, 0, 0);
  let bestColor: TslNode<"vec4"> = vec4(0, 0, 0, 0);
  let bestDist: TslNode<"float"> = float(1e10);

  for (const [dx, dy] of JFA_OFFSETS) {
    const sampleUv = uvNode.add(vec2(dx, dy).mul(stepNode).mul(invSizeNode));
    const candidatePosition = positionSourceTexture.sample(sampleUv);
    const dist = pixelCoord.sub(candidatePosition.xy).length();
    const isBetter = and(greaterThan(candidatePosition.z, float(0.5)), lessThan(dist, bestDist));

    bestPosition = select(isBetter, candidatePosition, bestPosition);
    bestColor = select(isBetter, colorSourceTexture.sample(sampleUv), bestColor);
    bestDist = select(isBetter, dist, bestDist);
  }

  return mrt({ position: bestPosition, color: bestColor });
}
