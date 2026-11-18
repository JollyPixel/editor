// Import Third-party Dependencies
import { Fn, max, oneMinus } from "three/tsl";

// Import Internal Dependencies
import { maskGate } from "./maskWeight.ts";
import type { TslNode, TslTextureNode } from "./tslNode.ts";

export interface HighlightCompositeChannel {
  edge1: TslTextureNode;
  edge2: TslTextureNode;
  mask: TslTextureNode;
}

export interface HighlightCompositeUniforms {
  edgeGlowNode: TslNode<"float">;
  hasPriorityNode: TslNode<"float">;
  hasIsolatedNode: TslNode<"float">;
}

function channelRing(
  channel: HighlightCompositeChannel,
  edgeGlowNode: TslNode<"float">
) {
  return channel.edge1.add(
    channel.edge2.mul(edgeGlowNode)
  ).mul(oneMinus(maskGate(channel.mask)));
}

export function buildHighlightComposite(
  shared: HighlightCompositeChannel,
  priority: HighlightCompositeChannel,
  isolated: HighlightCompositeChannel,
  uniforms: HighlightCompositeUniforms
) {
  const { edgeGlowNode, hasPriorityNode, hasIsolatedNode } = uniforms;

  return Fn(() => {
    const ring = channelRing(shared, edgeGlowNode);
    const priorityRing = channelRing(priority, edgeGlowNode).mul(hasPriorityNode);
    const isolatedRing = channelRing(isolated, edgeGlowNode).mul(hasIsolatedNode);

    return max(max(ring, priorityRing), isolatedRing);
  })();
}
