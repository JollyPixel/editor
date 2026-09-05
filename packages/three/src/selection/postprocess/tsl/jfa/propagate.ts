// Import Third-party Dependencies
import { mrt, select, and, float, vec2, vec4, uv, texture, greaterThan, lessThan } from "three/tsl";

// Import Internal Dependencies
import type { TslNode } from "../tslNode.ts";

// CONSTANTS
export const JFA_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1]
];

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
