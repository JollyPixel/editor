// Import Third-party Dependencies
import { saturate } from "three/tsl";

/**
 * "Is masked" signal for a sampled mask-buffer texel, shared by every
 * highlight technique's edge-detection/distance-field and composite steps in
 * place of the texture's own alpha channel. `setClearColor(color, 0)` does
 * not reliably clear a mask render target's alpha to 0 on this renderer
 * (verified empirically: sampling alpha directly reads 1 everywhere, drawn
 * pixels and background alike), so alpha isn't a usable channel here. RGB
 * itself clears to true black and is otherwise unused by anything
 * downstream, so its length doubles as a masked/not signal - correct as long
 * as no assigned entry color is at or near pure black, since that would read
 * as unmasked.
 *
 * `c` is deliberately left untyped (`noImplicitAny` is off for exactly this
 * kind of friction) - a hand-written parameter/return annotation would need
 * to match whichever specifically-branded TSL node type each call site
 * happens to pass, which `.rgb`/`.length()`'s own overloads already resolve
 * correctly without one.
 */
export function maskWeight(c) {
  return saturate(c.rgb.length());
}
