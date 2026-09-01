// Import Third-party Dependencies
import { Fn, If, float, vec2, vec4, uv, texture, greaterThan } from "three/tsl";

// Import Internal Dependencies
import { maskWeight } from "../maskWeight.ts";

/**
 * Seeds every masked texel with its own pixel coordinate (`valid = 1`);
 * every other texel starts invalid (`valid = 0`, own coordinate kept anyway,
 * though unused while invalid) - parameterized by which mask to read so the
 * shared, `priority`-only, and `isolated`-only chains can each reuse this
 * instead of duplicating it, the same "extract a builder function, call it
 * for every chain" shape `buildJfaPositionStep`/`buildJfaColorStep`
 * (`../jfa/propagate.ts`) already use.
 *
 * The color buffer's own seed init has no equivalent builder here - it's
 * just the mask texture itself, sampled directly (`fragmentNode = maskTexture`),
 * since every masked texel's own color already lives there.
 */
export function buildJfaSeedInit(
  maskTextureNode: ReturnType<typeof texture>,
  resolutionNode: ReturnType<typeof vec2>
) {
  return Fn(() => {
    const uvNode = uv();
    const masked = greaterThan(maskWeight(maskTextureNode.sample(uvNode)), float(0.5));
    const pixelCoord = uvNode.mul(resolutionNode);
    const result = vec4(pixelCoord, 0, 0).toVar();

    If(masked, () => {
      result.assign(vec4(pixelCoord, 1, 0));
    });

    return result;
  })();
}
