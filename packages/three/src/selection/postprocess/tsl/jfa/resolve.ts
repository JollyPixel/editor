// Import Third-party Dependencies
import { Fn, float, max, mix, oneMinus, smoothstep, uv, vec3, vec4, texture } from "three/tsl";

// Import Internal Dependencies
import { maskGate } from "../maskWeight.ts";
import type { TslNode } from "../tslNode.ts";

export interface JfaRingChannel {
  positionTexture: ReturnType<typeof texture>;
  colorTexture: ReturnType<typeof texture>;
  maskTexture: ReturnType<typeof texture>;
}

interface JfaRingShape {
  ringThicknessNode: TslNode<"float">;
  borderThicknessNode: TslNode<"float">;
  fillOpacityNode: TslNode<"float">;
}

function buildChannelRing(
  uvNode: TslNode<"vec2">,
  pixelCoord: TslNode<"vec2">,
  channel: JfaRingChannel,
  shape: JfaRingShape
) {
  const { ringThicknessNode, borderThicknessNode, fillOpacityNode } = shape;
  const seedPos = channel.positionTexture.sample(uvNode);
  const seedColor = channel.colorTexture.sample(uvNode);
  const dist = pixelCoord.sub(seedPos.xy).length();
  const ownSurface = maskGate(channel.maskTexture.sample(uvNode));

  const ringShape = oneMinus(smoothstep(ringThicknessNode, ringThicknessNode.add(1), dist));
  const borderMix = smoothstep(borderThicknessNode, borderThicknessNode.add(1), dist);
  const bandColor = mix(vec3(0, 0, 0), seedColor.rgb, borderMix);
  const ring = ringShape.mul(oneMinus(ownSurface));

  const fill = seedColor.rgb.mul(fillOpacityNode).mul(ownSurface);

  return vec4(bandColor.mul(ring).add(fill), max(ring, ownSurface.mul(fillOpacityNode)));
}

export interface JfaCompositeUniforms {
  resolutionNode: TslNode<"vec2">;
  ringThicknessNode: TslNode<"float">;
  borderThicknessNode: TslNode<"float">;
  isolatedFillOpacityNode: TslNode<"float">;
  hasPriorityNode: TslNode<"float">;
  hasIsolatedNode: TslNode<"float">;
}

export function buildJfaRingComposite(
  uniforms: JfaCompositeUniforms,
  shared: JfaRingChannel,
  priority: JfaRingChannel,
  isolated: JfaRingChannel
) {
  const {
    resolutionNode, ringThicknessNode, borderThicknessNode, isolatedFillOpacityNode, hasPriorityNode, hasIsolatedNode
  } = uniforms;
  const noFillNode = float(0);
  const ringOnlyShape: JfaRingShape = { ringThicknessNode, borderThicknessNode, fillOpacityNode: noFillNode };
  const isolatedShape: JfaRingShape = { ringThicknessNode, borderThicknessNode, fillOpacityNode: isolatedFillOpacityNode };

  return Fn(() => {
    const uvNode = uv();
    const pixelCoord = uvNode.mul(resolutionNode);

    const sharedRing = buildChannelRing(uvNode, pixelCoord, shared, ringOnlyShape);
    const priorityRing = buildChannelRing(uvNode, pixelCoord, priority, ringOnlyShape).mul(hasPriorityNode);
    const isolatedRing = buildChannelRing(uvNode, pixelCoord, isolated, isolatedShape).mul(hasIsolatedNode);

    return max(max(sharedRing, priorityRing), isolatedRing);
  })();
}
