// Import Third-party Dependencies
import { Fn, max, oneMinus, texture } from "three/tsl";

// Import Internal Dependencies
import { maskGate } from "./maskWeight.ts";
import type { TslNode } from "./tslNode.ts";

/**
 * One edge-detect chain's contribution to the final composite: the
 * blurred edge value (glow-weighted sum of the two blur levels), masked
 * out of the outlined object's own surface via `oneMinus(maskGate(...))` -
 * `maskGate` reads exactly `1` on an outlined object's own rasterized
 * pixels regardless of color (see its own doc comment for why `maskGate`,
 * not `maskWeight`, is needed here), so `oneMinus` keeps the ring in the
 * surrounding background only.
 */
export interface HighlightCompositeChannel {
  edge1: ReturnType<typeof texture>;
  edge2: ReturnType<typeof texture>;
  mask: ReturnType<typeof texture>;
}

/**
 * Combines the shared, `priority`-only, and `isolated`-only edge-detect
 * chains into the final composite output.
 *
 * `max()`, not `add()`: at a `priority`/`isolated` entry's own exposed
 * boundary, that channel and the shared channel independently detect
 * essentially the same edge, and summing them would double-brighten it
 * for no reason - `max()` is at least as visible as either channel alone
 * without the overshoot, and a no-op wherever only one channel has
 * anything to contribute (e.g. a `priority` entry fully enclosed inside a
 * larger non-priority one).
 */
export function buildHighlightComposite(
  shared: HighlightCompositeChannel,
  priority: HighlightCompositeChannel,
  isolated: HighlightCompositeChannel,
  edgeGlowNode: TslNode<"float">
) {
  return Fn(() => {
    const ring = shared.edge1.add(shared.edge2.mul(edgeGlowNode)).mul(oneMinus(maskGate(shared.mask)));
    const priorityRing = priority.edge1.add(priority.edge2.mul(edgeGlowNode)).mul(oneMinus(maskGate(priority.mask)));
    const isolatedRing = isolated.edge1.add(isolated.edge2.mul(edgeGlowNode)).mul(oneMinus(maskGate(isolated.mask)));

    return max(max(ring, priorityRing), isolatedRing);
  })();
}
