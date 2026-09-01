// Import Third-party Dependencies
import {
  Fn,
  vec2,
  vec4,
  uv,
  texture,
  max,
  saturate
} from "three/tsl";

// Import Internal Dependencies
import { maskWeight } from "./maskWeight.ts";

/**
 * 4-neighbor edge detection over a downsampled mask - shared by every mask
 * chain a caller builds (the shared chain, plus a `priority`-only and an
 * `isolated`-only chain, see `HighlightPass`'s own doc comments) so they all
 * reuse the exact same shader instead of duplicating it, parameterized only
 * by which downsampled mask texture to read.
 *
 * Edge-detection boundary strength comes from the RGB *distance* between
 * neighboring mask texels, not from `maskWeight`'s (background-vs-masked)
 * signal - two different entry colors can have near-identical RGB length
 * (e.g. orange `(.98,.42,.42)` and teal `(.16,.80,.83)`, both length ~1.15)
 * despite being visually distinct, which would otherwise silently drop the
 * edge between two adjacent, differently-colored selections and only ever
 * detect mask-vs-background boundaries. RGB distance catches both cases. At
 * a boundary where two different colors meet (two peers' outlines touching),
 * the shader still blends the neighboring colors' weighted average for the
 * edge's own color rather than picking one - a known, accepted
 * approximation, not a bug; only the *detection* of that boundary needed
 * fixing, not the color chosen once it's found.
 */
export function buildEdgeDetection(
  maskDownSampleTexture: ReturnType<typeof texture>,
  invSizeNode: ReturnType<typeof vec2>
) {
  return Fn(() => {
    const uvNode = uv();

    const c1 = maskDownSampleTexture.sample(uvNode.add(vec2(invSizeNode.x, 0))).toVar();
    const c2 = maskDownSampleTexture.sample(uvNode.sub(vec2(invSizeNode.x, 0))).toVar();
    const c3 = maskDownSampleTexture.sample(uvNode.add(vec2(0, invSizeNode.y))).toVar();
    const c4 = maskDownSampleTexture.sample(uvNode.sub(vec2(0, invSizeNode.y))).toVar();

    const diff1 = c1.rgb.sub(c2.rgb).length().mul(0.5);
    const diff2 = c3.rgb.sub(c4.rgb).length().mul(0.5);
    const edgeStrength = saturate(vec2(diff1, diff2).length());

    const w1 = maskWeight(c1);
    const w2 = maskWeight(c2);
    const w3 = maskWeight(c3);
    const w4 = maskWeight(c4);

    const colorSum = c1.rgb.mul(w1)
      .add(c2.rgb.mul(w2))
      .add(c3.rgb.mul(w3))
      .add(c4.rgb.mul(w4));
    const weightSum = w1.add(w2).add(w3).add(w4);
    const edgeColor = colorSum.div(max(weightSum, 0.0001));

    return vec4(edgeColor, 1).mul(edgeStrength);
  })();
}
