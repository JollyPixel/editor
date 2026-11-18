// Import Third-party Dependencies
import { select, float, vec2, vec4, uv, lessThan } from "three/tsl";

// Import Internal Dependencies
import type { TslNode, TslTextureNode } from "../tslNode.ts";
import { JFA_NO_SEED } from "./seed.ts";

// CONSTANTS
export const JFA_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1]
];

export function buildJfaPropagateStep(
  positionSourceTexture: TslTextureNode,
  stepNode: TslNode<"float">,
  invSizeNode: TslNode<"vec2">,
  resolutionNode: TslNode<"vec2">
) {
  const uvNode = uv();
  const pixelCoord = uvNode.mul(resolutionNode);

  let bestPosition: TslNode<"vec2"> = vec2(JFA_NO_SEED, JFA_NO_SEED);
  let bestDist: TslNode<"float"> = float(1e10);

  for (const [dx, dy] of JFA_OFFSETS) {
    const sampleUv = uvNode.add(vec2(dx, dy).mul(stepNode).mul(invSizeNode));
    const candidate = positionSourceTexture.sample(sampleUv).xy;
    const dist = pixelCoord.sub(candidate).length();
    const isBetter = lessThan(dist, bestDist);

    bestPosition = select(isBetter, candidate, bestPosition);
    bestDist = select(isBetter, dist, bestDist);
  }

  return vec4(bestPosition, 0, 0);
}

export function jfaStepSizes(
  reach: number
): number[] {
  let step = 1;
  while ((step * 2) - 1 < reach) {
    step *= 2;
  }

  const steps: number[] = [];
  for (; step >= 1; step /= 2) {
    steps.push(step);
  }
  steps.push(1);

  return steps;
}
