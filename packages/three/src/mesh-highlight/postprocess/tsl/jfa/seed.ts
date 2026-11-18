// Import Third-party Dependencies
import { select, float, vec2, vec4, uv, greaterThan } from "three/tsl";

// Import Internal Dependencies
import { maskGate } from "../maskWeight.ts";
import type { TslNode, TslTextureNode } from "../tslNode.ts";

// CONSTANTS
export const JFA_NO_SEED = -1e6;

export function buildJfaSeedInit(
  maskTextureNode: TslTextureNode,
  resolutionNode: TslNode<"vec2">
) {
  const uvNode = uv();
  const masked = greaterThan(maskGate(maskTextureNode.sample(uvNode)), float(0.5));
  const position = select(
    masked,
    uvNode.mul(resolutionNode),
    vec2(JFA_NO_SEED, JFA_NO_SEED)
  );

  return vec4(position, 0, 0);
}
