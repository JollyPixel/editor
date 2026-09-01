// Import Third-party Dependencies
import { Fn, max, oneMinus, smoothstep, uv, vec2, vec4, float, texture } from "three/tsl";

// Import Internal Dependencies
import { maskWeight } from "../maskWeight.ts";

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

/**
 * `uvNode`/`pixelCoord` are deliberately left untyped (`noImplicitAny` is
 * off for exactly this kind of friction) - `uv()`/`.mul()` chains produce
 * TSL node types too specifically branded for a hand-written
 * `ReturnType<typeof uv>`/`ReturnType<typeof vec2>` annotation to accept,
 * the same friction `tsl/gaussianBlur.ts`'s own `gaussianPdf` documents on
 * its own untyped params.
 */
function buildChannelRing(
  uvNode,
  pixelCoord,
  channel: JfaRingChannel,
  ringThicknessNode: ReturnType<typeof float>
) {
  const seedPos = channel.positionTexture.sample(uvNode);
  const seedColor = channel.colorTexture.sample(uvNode);
  const dist = pixelCoord.sub(seedPos.xy).length();

  const ringShape = oneMinus(smoothstep(ringThicknessNode, ringThicknessNode.add(1), dist));
  const ring = ringShape.mul(oneMinus(maskWeight(channel.maskTexture.sample(uvNode))));

  return vec4(seedColor.rgb, 1).mul(ring);
}

/**
 * Ring shape: solid out to `ringThickness` pixels from the nearest masked
 * seed, ~1px smoothstep falloff past that, zeroed back out over the entry's
 * own rasterized pixels (`oneMinus(maskWeight(...))`) so the ring only ever
 * paints into the surrounding background - the distance-field equivalent of
 * `tsl/composite.ts`'s own `oneMinus(maskWeight(...))` gate, just against a
 * real per-pixel distance instead of a blurred edge map.
 *
 * `priority`/`isolated` rings are the same shape, each computed from their
 * own independent chain - combined via `max()`, not `add()`, for the same
 * reason `tsl/composite.ts` does: at an entry's own exposed boundary (the
 * common case), multiple channels independently detect essentially the same
 * ring, and summing them would double-brighten it for no reason.
 * `hasPriorityNode`/`hasIsolatedNode` zero their own channel out entirely on
 * a frame with none of that kind of entry - the caller skips re-running that
 * chain's propagation then, so without this gate a stale ring from whenever
 * such entries were last present could otherwise leak through forever.
 */
export interface JfaCompositeUniforms {
  resolutionNode: ReturnType<typeof vec2>;
  ringThicknessNode: ReturnType<typeof float>;
  /** Gates the priority channel's own contribution - `0` on a frame with no `priority` entries. */
  hasPriorityNode: ReturnType<typeof float>;
  /** Same role as `hasPriorityNode`, for the isolated channel. */
  hasIsolatedNode: ReturnType<typeof float>;
}

export function buildJfaRingComposite(
  uniforms: JfaCompositeUniforms,
  shared: JfaRingChannel,
  priority: JfaRingChannel,
  isolated: JfaRingChannel
) {
  const { resolutionNode, ringThicknessNode, hasPriorityNode, hasIsolatedNode } = uniforms;

  return Fn(() => {
    const uvNode = uv();
    const pixelCoord = uvNode.mul(resolutionNode);

    const sharedRing = buildChannelRing(uvNode, pixelCoord, shared, ringThicknessNode);
    const priorityRing = buildChannelRing(uvNode, pixelCoord, priority, ringThicknessNode).mul(hasPriorityNode);
    const isolatedRing = buildChannelRing(uvNode, pixelCoord, isolated, ringThicknessNode).mul(hasIsolatedNode);

    return max(max(sharedRing, priorityRing), isolatedRing);
  })();
}
