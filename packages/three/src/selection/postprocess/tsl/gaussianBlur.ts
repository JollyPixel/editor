// Import Third-party Dependencies
import {
  Fn,
  Loop,
  int,
  float,
  uv,
  texture,
  exp
} from "three/tsl";

// Import Internal Dependencies
import type { TslNode } from "./tslNode.ts";

// CONSTANTS
// Matches OutlineNode's own separable-blur kernel radius.
export const MAX_BLUR_RADIUS = 4;

/**
 * Plain TS helper (not a TSL `Fn`) - `Fn`'s inferred type only covers its
 * zero-arg/`NodeBuilder`-callback overloads, not this multi-parameter TSL
 * function form. A regular function inlines the same math into whichever
 * shader calls it.
 */
function gaussianPdf(
  x: TslNode<"float">,
  sigma: TslNode<"float">
): TslNode<"float"> {
  return float(0.39894).mul(exp(float(-0.5).mul(x).mul(x).div(sigma.mul(sigma))).div(sigma));
}

/**
 * Separable Gaussian blur, same shape as `OutlineNode.separableBlur` - built
 * once per resolution level (half-res "thickness" pass, quarter-res "glow"
 * pass) via `kernelRadius`, run X then Y via `blurDirectionNode`, toggled
 * between calls by the caller.
 */
export function buildSeparableBlur(
  blurSourceTexture: ReturnType<typeof texture>,
  blurDirectionNode: TslNode<"vec2">,
  invSizeNode: TslNode<"vec2">,
  kernelRadius: TslNode<"float">
) {
  return Fn(() => {
    const uvNode = uv();
    const sigma = kernelRadius.div(2).toVar();
    const weightSum = gaussianPdf(float(0), sigma).toVar();
    const diffuseSum = blurSourceTexture.sample(uvNode).mul(weightSum).toVar();
    const delta = blurDirectionNode.mul(invSizeNode).mul(kernelRadius).div(MAX_BLUR_RADIUS).toVar();
    const uvOffset = delta.toVar();

    Loop({ start: int(1), end: int(MAX_BLUR_RADIUS), type: "int", condition: "<=" }, ({ i }) => {
      const x = kernelRadius.mul(float(i)).div(MAX_BLUR_RADIUS);
      const w = gaussianPdf(x, sigma);
      const sample1 = blurSourceTexture.sample(uvNode.add(uvOffset));
      const sample2 = blurSourceTexture.sample(uvNode.sub(uvOffset));

      diffuseSum.addAssign(sample1.add(sample2).mul(w));
      weightSum.addAssign(w.mul(2));
      uvOffset.addAssign(delta);
    });

    return diffuseSum.div(weightSum);
  })();
}
