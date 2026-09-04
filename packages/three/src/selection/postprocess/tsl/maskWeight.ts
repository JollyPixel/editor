// Import Third-party Dependencies
import { select, greaterThan, float, saturate } from "three/tsl";

/**
 * "Is masked" signal for a sampled mask-buffer texel, shared by every
 * highlight technique's edge-detection/distance-field and composite steps
 * in place of the texture's own alpha channel - `setClearColor(color, 0)`
 * doesn't reliably clear a mask render target's alpha to 0 on this
 * renderer (verified empirically: sampling alpha reads 1 everywhere). RGB
 * clears to true black and is otherwise unused downstream, so its length
 * doubles as a masked/not signal.
 *
 * A *continuous* weight, deliberately - `buildEdgeDetection` uses it as a
 * real blend weight (a weighted average of up to 4 neighboring mask
 * colors), not a yes/no gate. A caller needing a hard "is this texel
 * masked" boolean wants `maskGate` below instead.
 *
 * `c` is deliberately left untyped - a hand-written annotation would need
 * to match whichever branded TSL node type each call site passes, which
 * `.rgb`/`.length()`'s own overloads already resolve without one.
 */
export function maskWeight(c) {
  return saturate(c.rgb.length());
}

/**
 * Binary (`0`/`1`) form of `maskWeight`, for a caller that needs a hard
 * yes/no rather than its continuous magnitude. `maskWeight` only reaches
 * exactly `1` for a handful of maximally-saturated colors - any more
 * ordinary assigned color reads as some fraction below that, which
 * silently broke callers assuming a clean 0/1 split: `tsl/jfa/seed.ts`
 * missed seeding a peer's own silhouette whenever their color's RGB
 * length fell under the comparison threshold, and
 * `tsl/composite.ts`/`tsl/jfa/resolve.ts`'s `oneMinus(maskWeight(...))`
 * ring-suppression gate was never fully `0` either, letting ring color
 * bleed across the selected mesh - both reproduced live with a real
 * allocated color of `rgb(5, 52, 91)` (RGB length ~0.41).
 *
 * A background texel is a hard clear to `(0,0,0,0)`, never
 * computed/blended, so it reads back as exactly `0` - any nonzero weight
 * reliably means "something was drawn here", hence the threshold sits at
 * `0`. Still `>`, not `>=`, to keep the one documented limitation: an
 * assigned color of exactly pure black.
 */
export function maskGate(c) {
  return select(greaterThan(maskWeight(c), float(0)), float(1), float(0));
}
