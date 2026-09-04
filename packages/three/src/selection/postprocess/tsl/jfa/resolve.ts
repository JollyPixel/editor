// Import Third-party Dependencies
import { Fn, float, max, mix, oneMinus, smoothstep, uv, vec3, vec4, texture } from "three/tsl";

// Import Internal Dependencies
import { maskGate } from "../maskWeight.ts";
import type { TslNode } from "../tslNode.ts";

/**
 * One Jump Flood chain's own final position/color buffers plus the mask
 * texture its seeds were drawn from - everything `buildJfaRingComposite`
 * needs to derive that chain's own ring contribution.
 */
export interface JfaRingChannel {
  positionTexture: ReturnType<typeof texture>;
  colorTexture: ReturnType<typeof texture>;
  maskTexture: ReturnType<typeof texture>;
}

/** Shape uniforms `buildChannelRing` needs, grouped so the function itself stays under the param-count limit. */
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
  // Same "solid, then ~1px smoothstep transition" style as `ringShape`'s own
  // outer falloff, just for the inner black-border/entry-color split instead
  // of the outer ring/background one - see `buildJfaRingComposite`'s own doc
  // comment for why this band exists at all.
  const borderMix = smoothstep(borderThicknessNode, borderThicknessNode.add(1), dist);
  const bandColor = mix(vec3(0, 0, 0), seedColor.rgb, borderMix);
  const ring = ringShape.mul(oneMinus(ownSurface));

  // `fillOpacityNode` is the one deliberate exception to "the ring only ever
  // paints into the surrounding background" above - see `JfaCompositeUniforms
  // .isolatedFillOpacityNode`'s own doc comment for why the isolated channel
  // alone gets a faint wash across the entry's own surface too, additive on
  // top of the ring rather than replacing any of it.
  const fill = seedColor.rgb.mul(fillOpacityNode).mul(ownSurface);

  return vec4(bandColor.mul(ring).add(fill), max(ring, ownSurface.mul(fillOpacityNode)));
}

/**
 * Ring shape: a solid black border out to `borderThickness` pixels from
 * the nearest masked seed, ~1px smoothstep transition into that seed's
 * own color out to `ringThickness` pixels, ~1px smoothstep falloff to
 * fully transparent past that, zeroed out over the entry's own rasterized
 * pixels so the ring only paints into the surrounding background - the
 * distance-field equivalent of `tsl/composite.ts`'s own
 * `oneMinus(maskGate(...))` gate, against a real distance instead of a
 * blurred edge map.
 *
 * The border exists so the ring stays readable regardless of how close a
 * peer-allocated color happens to sit to the outlined mesh's own material
 * color - a black band pinned against the silhouette gives a
 * guaranteed-contrasting boundary before the color itself is read against
 * the scene background. `borderThickness` larger than `ringThickness`
 * makes the whole ring solid black - a plausible intentional
 * configuration, not guarded against.
 *
 * `priority`/`isolated` rings are the same shape, combined via `max()` for
 * the same double-brightening-avoidance reason as `tsl/composite.ts`.
 * `hasPriorityNode`/`hasIsolatedNode` zero their own channel out entirely
 * on a frame with none of that entry kind, since the caller skips
 * re-running that chain's propagation and a stale ring could otherwise
 * leak through forever.
 */
export interface JfaCompositeUniforms {
  resolutionNode: TslNode<"vec2">;
  ringThicknessNode: TslNode<"float">;
  /** See `buildChannelRing`'s own comment for the shape this produces. */
  borderThicknessNode: TslNode<"float">;
  /**
   * Faint additive wash of the hoverer's own color across the entry's own
   * surface, isolated-channel only - a ring alone is a weak cue for a
   * transient hover nobody's necessarily looking at yet, unlike a
   * deliberate selection. `0` disables it; shared/priority never get one.
   */
  isolatedFillOpacityNode: TslNode<"float">;
  /** Gates the priority channel's own contribution - `0` on a frame with no `priority` entries. */
  hasPriorityNode: TslNode<"float">;
  /** Same role as `hasPriorityNode`, for the isolated channel. */
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
