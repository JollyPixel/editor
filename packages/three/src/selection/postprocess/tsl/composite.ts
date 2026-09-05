// Import Third-party Dependencies
import { Fn, max, oneMinus, texture } from "three/tsl";

// Import Internal Dependencies
import { maskGate } from "./maskWeight.ts";
import type { TslNode } from "./tslNode.ts";

export interface HighlightCompositeChannel {
  edge1: ReturnType<typeof texture>;
  edge2: ReturnType<typeof texture>;
  mask: ReturnType<typeof texture>;
}

export function buildHighlightComposite(
  shared: HighlightCompositeChannel,
  priority: HighlightCompositeChannel,
  isolated: HighlightCompositeChannel,
  edgeGlowNode: TslNode<"float">
) {
  return Fn(() => {
    const ring = shared.edge1.add(
      shared.edge2.mul(edgeGlowNode)
    ).mul(oneMinus(maskGate(shared.mask)));
    const priorityRing = priority.edge1.add(
      priority.edge2.mul(edgeGlowNode)
    ).mul(oneMinus(maskGate(priority.mask)));
    const isolatedRing = isolated.edge1.add(
      isolated.edge2.mul(edgeGlowNode)
    ).mul(oneMinus(maskGate(isolated.mask)));

    return max(max(ring, priorityRing), isolatedRing);
  })();
}
