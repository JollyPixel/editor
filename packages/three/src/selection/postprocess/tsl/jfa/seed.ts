// Import Third-party Dependencies
import { mrt, select, float, vec4, uv, texture, greaterThan } from "three/tsl";

// Import Internal Dependencies
import { maskGate } from "../maskWeight.ts";
import type { TslNode } from "../tslNode.ts";

/**
 * Seeds every masked texel with its own pixel coordinate (`valid = 1`) and
 * color, in one MRT output; every other texel's position starts invalid
 * (`valid = 0`). Parameterized by which mask to read so the shared,
 * `priority`-only, and `isolated`-only chains can each reuse this instead
 * of duplicating it. The color output needs no `masked` branch of its own -
 * it's just the mask texture's value at this texel either way, since an
 * unmasked texel's position stays invalid regardless of what color sits
 * alongside it.
 *
 * Deliberately *not* wrapped in `Fn(() => {...})()` - confirmed live that a
 * `mrt(...)` returned from inside a `Fn()` call silently reads back as
 * all-zero on every output, with no compile error. `mrt(...)` only works
 * correctly as the material's `fragmentNode` directly (or nested in plain
 * function calls that aren't themselves `Fn()`-built) - this function
 * doesn't need `Fn()`'s imperative-statement stack (`select()` is a plain
 * ternary), so dropping the wrapper costs nothing.
 */
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
