// Import Third-party Dependencies
import { mrt, select, float, vec4, uv, texture, greaterThan } from "three/tsl";

// Import Internal Dependencies
import { maskGate } from "../maskWeight.ts";
import type { TslNode } from "../tslNode.ts";

export function buildJfaSeedInit(
  maskTextureNode: ReturnType<typeof texture>,
  resolutionNode: TslNode<"vec2">
) {
  const uvNode = uv();
  const maskSample = maskTextureNode.sample(uvNode);
  const masked = greaterThan(maskGate(maskSample), float(0.5));
  const pixelCoord = uvNode.mul(resolutionNode);
  const position = select(masked, vec4(pixelCoord, 1, 0), vec4(pixelCoord, 0, 0));

  return mrt({ position, color: maskSample });
}
