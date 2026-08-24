// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  Fn,
  float,
  vec2,
  vec3,
  vec4,
  uv,
  uniform,
  texture,
  max,
  greaterThan,
  lessThan,
  and,
  If,
  oneMinus,
  saturate,
  smoothstep,
  pass
} from "three/tsl";

// Import Internal Dependencies
import type { ColoredOutlineEntry } from "../../../src/index.ts";

// CONSTANTS
/**
 * 9-neighbor Jump Flood sampling pattern (the 8 compass directions plus the
 * center/self offset) - a fixed, small set, so it's unrolled as plain JS
 * `for` loops building the shader graph rather than a TSL `Loop()` (same
 * "manually unroll a small fixed neighborhood" style `ColoredOutlinePass`'s
 * own `buildEdgeDetection` already uses for its 4-neighbor scan).
 */
const kJfaOffsets: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1]
];

/**
 * Same "is this texel masked" signal `ColoredOutlinePass` uses (RGB length,
 * not the alpha channel - see that class's own `maskWeight` doc comment for
 * why alpha isn't reliable on this renderer). Duplicated here rather than
 * imported since this file is deliberately standalone (see this class's own
 * doc comment).
 */
function maskWeight(c) {
  return saturate(c.rgb.length());
}

/**
 * Seeds every masked texel with its own pixel coordinate (`valid = 1`);
 * every other texel starts invalid (`valid = 0`, own coordinate kept anyway,
 * though unused while invalid) - parameterized by which mask to read so the
 * shared and priority-only chains (see `#renderTargetPriorityMask`'s own doc
 * comment) can reuse this instead of duplicating it, the same "extract a
 * builder function, call it twice" shape `buildJfaPositionStep`/
 * `buildJfaColorStep` already use below.
 */
function buildSeedPositionInit(
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

/**
 * One Jump Flood propagation step for the *position* buffer: for the current
 * texel, checks the 9 neighbors (at `stepNode` texels away) of the previous
 * iteration's position buffer and keeps whichever one is nearest in pixel
 * space, carrying that neighbor's own stored seed position forward. `vec4`
 * layout: `xy` = seed's own pixel coordinate, `z` = valid flag (`1`/`0`),
 * `w` unused.
 */
function buildJfaPositionStep(
  positionSourceTexture: ReturnType<typeof texture>,
  stepNode: ReturnType<typeof float>,
  invSizeNode: ReturnType<typeof vec2>,
  resolutionNode: ReturnType<typeof vec2>
) {
  return Fn(() => {
    const uvNode = uv();
    const pixelCoord = uvNode.mul(resolutionNode).toVar();
    const best = vec4(0, 0, 0, 0).toVar();
    const bestDist = float(1e10).toVar();

    for (const [dx, dy] of kJfaOffsets) {
      const sampleUv = uvNode.add(vec2(dx, dy).mul(stepNode).mul(invSizeNode));
      const candidate = positionSourceTexture.sample(sampleUv).toVar();
      const dist = pixelCoord.sub(candidate.xy).length();

      If(and(greaterThan(candidate.z, float(0.5)), lessThan(dist, bestDist)), () => {
        best.assign(candidate);
        bestDist.assign(dist);
      });
    }

    return best;
  })();
}

/**
 * The color-buffer twin of `buildJfaPositionStep` - re-derives the exact
 * same "which of the 9 neighbors is nearest" decision (same source texture,
 * same math, so it agrees with the position step's own choice - see this
 * class's own doc comment for why this simpler "recompute the same decision
 * twice" approach was chosen over packing color into the position buffer or
 * a multi-render-target step), then outputs *that* neighbor's color instead
 * of its position.
 */
function buildJfaColorStep(
  positionSourceTexture: ReturnType<typeof texture>,
  colorSourceTexture: ReturnType<typeof texture>,
  stepNode: ReturnType<typeof float>,
  invSizeNode: ReturnType<typeof vec2>,
  resolutionNode: ReturnType<typeof vec2>
) {
  return Fn(() => {
    const uvNode = uv();
    const pixelCoord = uvNode.mul(resolutionNode).toVar();
    const bestColor = vec4(0, 0, 0, 0).toVar();
    const bestDist = float(1e10).toVar();

    for (const [dx, dy] of kJfaOffsets) {
      const offset = vec2(dx, dy).mul(stepNode).mul(invSizeNode);
      const sampleUv = uvNode.add(offset);
      const candidatePos = positionSourceTexture.sample(sampleUv).toVar();
      const dist = pixelCoord.sub(candidatePos.xy).length();

      If(and(greaterThan(candidatePos.z, float(0.5)), lessThan(dist, bestDist)), () => {
        bestDist.assign(dist);
        bestColor.assign(colorSourceTexture.sample(sampleUv));
      });
    }

    return bestColor;
  })();
}

export interface JumpFloodOutlinePassOptions {
  /**
   * Ring thickness, in screen pixels - unlike `ColoredOutlinePass.edgeThickness`
   * (downsampled pixels, blur-kernel-radius-shaped), this is an exact,
   * resolution-independent pixel count: the Jump Flood distance field is a
   * real per-pixel distance to the silhouette, not a blur radius, so the
   * ring reads the same width at any viewing angle or downsample level.
   * @default 2
   */
  ringThickness?: number;
}

/**
 * Research-spike prototype (Phase 6 of the original architecture roadmap for
 * `src/selection` - see `docs/ColoredOutlinePass.md`'s own "Alternative
 * considered: Jump Flood Algorithm" note) comparing a Jump Flood Algorithm
 * outline against
 * `ColoredOutlinePass`'s existing Sobel-diff-edge-detect + separable-blur
 * approach. Deliberately lives here in `examples/`, not `src/` - it is not a
 * published package API, has no test coverage, and intentionally skips the
 * one thing `ColoredOutlinePass` earns its size from beyond the ring shape
 * itself: `InstancedMesh` support. Its main job is to answer one question
 * visually: does JFA's uniform, resolution-independent ring actually look
 * better than the blurred one, and is it worth productionizing. See
 * `examples/scripts/demo-selection.ts`'s "Peer rendering" -> "colors (JFA
 * prototype)" option to compare them side-by-side against the same
 * scene/entries.
 *
 * Same overall shape as `ColoredOutlinePass` (mask pass, `RenderPipeline`
 * compositing the ring onto a `pass(scene, camera)`), but the
 * downsample/edge-detect/blur chain is replaced with a real distance field:
 * 1. Mask pass - flat per-entry color, depth-tested, exactly like
 *    `ColoredOutlinePass`'s own non-priority mask pass.
 * 2. Seed init - every masked texel seeds itself (its own pixel coordinate,
 *    `valid = 1`); every other texel starts invalid.
 * 3. `O(log2(max(width, height)))` Jump Flood passes, each halving the
 *    sample step, propagating the nearest seed's position (and, via a
 *    second, parallel pass re-deriving the same nearest-neighbor decision -
 *    see `buildJfaColorStep`'s own doc comment - its color) to every texel.
 * 4. Composite - every texel now knows the pixel-space distance to its
 *    nearest masked seed; a background texel within `ringThickness` of one
 *    draws that seed's color, with a ~1px smoothstep falloff at the edge.
 *
 * Ping-pongs two independent render-target pairs (`#renderTargetSeedPosA`/`B`,
 * `#renderTargetSeedColorA`/`B`) across the Jump Flood passes, alternating
 * which one is "source" vs "destination" each iteration (same `.value`
 * reassignment technique `ColoredOutlinePass`'s own blur passes use) - a
 * texture can't be read and written in the same GPU pass.
 *
 * @note
 * Requires `THREE.WebGPURenderer`. Owns its own `RenderPipeline` - pick one
 * whole-frame postprocess pipeline per scene, same caveat as
 * `ColoredOutlinePass`.
 *
 * @note
 * `priority` entries (`ColoredOutlineEntry.priority`) work the same as
 * `ColoredOutlinePass`'s own - see `#renderTargetPriorityMask`'s own doc
 * comment for the mechanism, which mirrors that class's exactly (a
 * `depthTest: false` redraw so priority wins the shared mask's overlap
 * contest, plus a second, independent mask/seed/propagate chain so a
 * priority entry's ring still has somewhere to draw even when its silhouette
 * is entirely enclosed inside a larger, nearer non-priority entry's own).
 * Always on for whichever entries are marked `priority` - no separate option
 * to enable it, same as `ColoredOutlinePass` - and free (skipped entirely,
 * same as that class) on a frame with no priority entries.
 *
 * @note
 * `isolated` entries (`ColoredOutlineEntry.isolated`) also work the same as
 * `ColoredOutlinePass`'s own - see `#renderTargetIsolatedMask`'s own doc
 * comment. The opposite of `priority`: a third, independent mask/seed/
 * propagate chain, but no shared-mask redraw at all - an isolated entry
 * never competes for the shared mask's own pixels, so it can neither be cut
 * by another entry nor cut one itself.
 */
export class JumpFloodOutlinePass {
  readonly pipeline: THREE.RenderPipeline;

  #renderer: THREE.WebGPURenderer;
  #scene: THREE.Scene;
  #camera: THREE.Camera;

  #entryByMesh = new Map<THREE.Mesh, THREE.Color>();
  #entryCount = 0;
  /** Priority meshes, a subset of `#entryByMesh`'s own keys - see `#renderTargetPriorityMask`'s own doc comment. */
  #priorityMeshes = new Set<THREE.Mesh>();
  /** `isolated` entries land here instead - never part of `#entryByMesh` at all, see `#renderTargetIsolatedMask`'s own doc comment. */
  #isolatedEntryByMesh = new Map<THREE.Mesh, THREE.Color>();

  #ringThickness: number;
  #ringThicknessUniform: ReturnType<typeof uniform>;

  #resolution = new THREE.Vector2();
  #invSize = new THREE.Vector2();
  #resolutionUniform: ReturnType<typeof uniform>;
  #invSizeUniform: ReturnType<typeof uniform>;
  #maskColor = new THREE.Color();
  #maskColorUniform: ReturnType<typeof uniform>;
  /** `0`/`1` - gates the priority ring's own contribution in the composite; see `#hasPriorityUniform`'s own doc comment. */
  #hasPriorityUniform: ReturnType<typeof uniform>;
  /** Same role as `#hasPriorityUniform`, for the isolated channel. */
  #hasIsolatedUniform: ReturnType<typeof uniform>;

  /** Recomputed in `#setSize` - the standard JFA step sequence, largest power of two down to 1. */
  #stepSizes: number[] = [];
  /** Shared by both the primary and priority propagation chains - both progress through the same `#stepSizes` sequence in lockstep. */
  #jfaStepUniform: ReturnType<typeof uniform>;

  #renderTargetMask: THREE.RenderTarget;
  #renderTargetSeedPosA: THREE.RenderTarget;
  #renderTargetSeedPosB: THREE.RenderTarget;
  #renderTargetSeedColorA: THREE.RenderTarget;
  #renderTargetSeedColorB: THREE.RenderTarget;
  #renderTargetComposite: THREE.RenderTarget;

  /**
   * Second, independent mask - only ever populated by `priority` entries,
   * always `depthTest: false` (see `#priorityMaskMaterial`'s own doc
   * comment), and always cleared fresh, never layered onto the shared mask -
   * same shape as `ColoredOutlinePass.#renderTargetPriorityMask`, and it
   * exists for the exact same reason: the shared chain's own composite
   * contribution only ever draws a ring into pixels the shared mask doesn't
   * already claim, so a priority entry whose silhouette ends up entirely
   * enclosed inside a larger, nearer non-priority entry's own silhouette has
   * nowhere to paint even after the priority redraw below already won it the
   * right color underneath. This second mask (and its own seed/propagate
   * chain, `#renderTargetPrioritySeedPosA`/`B`/`#renderTargetPrioritySeedColorA`/`B`)
   * is excluded only by its own silhouette, so its ring always has somewhere
   * to go. Only built/run on a frame with at least one `priority` entry - see
   * `#hasPriorityUniform` and `#renderJumpFlood`.
   */
  #renderTargetPriorityMask: THREE.RenderTarget;
  #renderTargetPrioritySeedPosA: THREE.RenderTarget;
  #renderTargetPrioritySeedPosB: THREE.RenderTarget;
  #renderTargetPrioritySeedColorA: THREE.RenderTarget;
  #renderTargetPrioritySeedColorB: THREE.RenderTarget;

  /**
   * Third, independent mask - only ever populated by `isolated` entries,
   * same shape as `#renderTargetPriorityMask` (always `depthTest: false`,
   * always cleared fresh) but for the opposite reason: an `isolated` entry
   * never redraws into the shared mask at all (see
   * `ColoredOutlineEntry.isolated`'s own doc comment) - the shared mask's own
   * first pass simply never sees isolated meshes (they're never in
   * `#entryByMesh`, see `setEntries`). Its own seed/propagate chain
   * (`#renderTargetIsolatedSeedPosA`/`B`/`#renderTargetIsolatedSeedColorA`/`B`)
   * mirrors the priority one exactly.
   */
  #renderTargetIsolatedMask: THREE.RenderTarget;
  #renderTargetIsolatedSeedPosA: THREE.RenderTarget;
  #renderTargetIsolatedSeedPosB: THREE.RenderTarget;
  #renderTargetIsolatedSeedColorA: THREE.RenderTarget;
  #renderTargetIsolatedSeedColorB: THREE.RenderTarget;

  #maskTexture: ReturnType<typeof texture>;
  #compositeTexture: ReturnType<typeof texture>;
  /** Mutated (`.value`) to whichever of the A/B pair currently holds the source data - see `#renderJumpFlood`. */
  #jfaPositionSourceTexture: ReturnType<typeof texture>;
  #jfaColorSourceTexture: ReturnType<typeof texture>;
  /** Always reads whichever target the last-completed Jump Flood pass wrote to - see `#renderJumpFlood`. */
  #finalPositionTexture: ReturnType<typeof texture>;
  #finalColorTexture: ReturnType<typeof texture>;

  #priorityMaskTexture: ReturnType<typeof texture>;
  /** Same role as `#jfaPositionSourceTexture`/`#jfaColorSourceTexture`, for the priority-only chain. */
  #jfaPriorityPositionSourceTexture: ReturnType<typeof texture>;
  #jfaPriorityColorSourceTexture: ReturnType<typeof texture>;
  /** Same role as `#finalPositionTexture`/`#finalColorTexture`, for the priority-only chain. */
  #finalPriorityPositionTexture: ReturnType<typeof texture>;
  #finalPriorityColorTexture: ReturnType<typeof texture>;

  #isolatedMaskTexture: ReturnType<typeof texture>;
  /** Same role as `#jfaPositionSourceTexture`/`#jfaColorSourceTexture`, for the isolated-only chain. */
  #jfaIsolatedPositionSourceTexture: ReturnType<typeof texture>;
  #jfaIsolatedColorSourceTexture: ReturnType<typeof texture>;
  /** Same role as `#finalPositionTexture`/`#finalColorTexture`, for the isolated-only chain. */
  #finalIsolatedPositionTexture: ReturnType<typeof texture>;
  #finalIsolatedColorTexture: ReturnType<typeof texture>;

  #maskMaterial: THREE.NodeMaterial;
  #seedPositionInitMaterial: THREE.NodeMaterial;
  #seedColorInitMaterial: THREE.NodeMaterial;
  #jfaPositionStepMaterial: THREE.NodeMaterial;
  #jfaColorStepMaterial: THREE.NodeMaterial;
  #compositeMaterial: THREE.NodeMaterial;

  /**
   * `depthTest: false` so a priority entry always wins the shared mask
   * buffer regardless of its actual distance from the camera - same
   * reasoning as `ColoredOutlinePass.#priorityMaskMaterial`'s own doc
   * comment. Reused for the shared mask's own second (layered) pass,
   * `#renderTargetPriorityMask`'s single (fresh) pass, and
   * `#renderTargetIsolatedMask`'s own single (fresh) pass - stateless, only
   * reads `maskColorNode`/depth-test state, so one material covers all three.
   */
  #priorityMaskMaterial: THREE.NodeMaterial;
  #prioritySeedPositionInitMaterial: THREE.NodeMaterial;
  #prioritySeedColorInitMaterial: THREE.NodeMaterial;
  #jfaPriorityPositionStepMaterial: THREE.NodeMaterial;
  #jfaPriorityColorStepMaterial: THREE.NodeMaterial;

  #isolatedSeedPositionInitMaterial: THREE.NodeMaterial;
  #isolatedSeedColorInitMaterial: THREE.NodeMaterial;
  #jfaIsolatedPositionStepMaterial: THREE.NodeMaterial;
  #jfaIsolatedColorStepMaterial: THREE.NodeMaterial;

  #quad: THREE.QuadMesh;

  constructor(
    renderer: THREE.WebGPURenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    options: JumpFloodOutlinePassOptions = {}
  ) {
    const { ringThickness = 2 } = options;

    this.#renderer = renderer;
    this.#scene = scene;
    this.#camera = camera;
    this.#ringThickness = ringThickness;

    this.#ringThicknessUniform = uniform(ringThickness);
    this.#resolutionUniform = uniform(this.#resolution);
    this.#invSizeUniform = uniform(this.#invSize);
    this.#maskColorUniform = uniform(this.#maskColor);
    this.#jfaStepUniform = uniform(1);
    this.#hasPriorityUniform = uniform(0);
    this.#hasIsolatedUniform = uniform(0);

    // See `ColoredOutlinePass`'s own matching comment - `uniform()`'s return
    // type-checks as an untagged `UniformNode<unknown>`, which TSL's fluent
    // node methods can't resolve as an argument. Same live reference, just
    // narrowed for the type checker.
    const ringThicknessNode = this.#ringThicknessUniform as unknown as ReturnType<typeof float>;
    const resolutionNode = this.#resolutionUniform as unknown as ReturnType<typeof vec2>;
    const invSizeNode = this.#invSizeUniform as unknown as ReturnType<typeof vec2>;
    const maskColorNode = this.#maskColorUniform as unknown as ReturnType<typeof vec3>;
    const jfaStepNode = this.#jfaStepUniform as unknown as ReturnType<typeof float>;
    const hasPriorityNode = this.#hasPriorityUniform as unknown as ReturnType<typeof float>;
    const hasIsolatedNode = this.#hasIsolatedUniform as unknown as ReturnType<typeof float>;

    this.#renderTargetMask = new THREE.RenderTarget(1, 1);
    this.#renderTargetComposite = new THREE.RenderTarget(1, 1, { depthBuffer: false });

    // `FloatType`, not the default 8-bit-per-channel type - a seed's own
    // pixel coordinate (up to several thousand) needs real float precision
    // to compare distances correctly; an 8-bit texture would quantize it
    // into a handful of buckets and the whole distance field would be wrong.
    const seedPositionOptions = { depthBuffer: false, type: THREE.FloatType };
    this.#renderTargetSeedPosA = new THREE.RenderTarget(1, 1, seedPositionOptions);
    this.#renderTargetSeedPosB = new THREE.RenderTarget(1, 1, seedPositionOptions);
    this.#renderTargetSeedColorA = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetSeedColorB = new THREE.RenderTarget(1, 1, { depthBuffer: false });

    // No depth buffer - always drawn `depthTest: false` (see
    // `#priorityMaskMaterial`'s own doc comment), so it never needs one.
    this.#renderTargetPriorityMask = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetPrioritySeedPosA = new THREE.RenderTarget(1, 1, seedPositionOptions);
    this.#renderTargetPrioritySeedPosB = new THREE.RenderTarget(1, 1, seedPositionOptions);
    this.#renderTargetPrioritySeedColorA = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetPrioritySeedColorB = new THREE.RenderTarget(1, 1, { depthBuffer: false });

    // Same shape, for `isolated` entries - see `#renderTargetIsolatedMask`'s
    // own doc comment.
    this.#renderTargetIsolatedMask = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetIsolatedSeedPosA = new THREE.RenderTarget(1, 1, seedPositionOptions);
    this.#renderTargetIsolatedSeedPosB = new THREE.RenderTarget(1, 1, seedPositionOptions);
    this.#renderTargetIsolatedSeedColorA = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetIsolatedSeedColorB = new THREE.RenderTarget(1, 1, { depthBuffer: false });

    this.#maskTexture = texture(this.#renderTargetMask.texture);
    this.#compositeTexture = texture(this.#renderTargetComposite.texture);
    this.#jfaPositionSourceTexture = texture(this.#renderTargetSeedPosA.texture);
    this.#jfaColorSourceTexture = texture(this.#renderTargetSeedColorA.texture);
    this.#finalPositionTexture = texture(this.#renderTargetSeedPosA.texture);
    this.#finalColorTexture = texture(this.#renderTargetSeedColorA.texture);

    this.#priorityMaskTexture = texture(this.#renderTargetPriorityMask.texture);
    this.#jfaPriorityPositionSourceTexture = texture(this.#renderTargetPrioritySeedPosA.texture);
    this.#jfaPriorityColorSourceTexture = texture(this.#renderTargetPrioritySeedColorA.texture);
    this.#finalPriorityPositionTexture = texture(this.#renderTargetPrioritySeedPosA.texture);
    this.#finalPriorityColorTexture = texture(this.#renderTargetPrioritySeedColorA.texture);

    this.#isolatedMaskTexture = texture(this.#renderTargetIsolatedMask.texture);
    this.#jfaIsolatedPositionSourceTexture = texture(this.#renderTargetIsolatedSeedPosA.texture);
    this.#jfaIsolatedColorSourceTexture = texture(this.#renderTargetIsolatedSeedColorA.texture);
    this.#finalIsolatedPositionTexture = texture(this.#renderTargetIsolatedSeedPosA.texture);
    this.#finalIsolatedColorTexture = texture(this.#renderTargetIsolatedSeedColorA.texture);

    const scenePassNode = pass(scene, camera);

    this.#maskMaterial = new THREE.NodeMaterial();
    this.#maskMaterial.name = "JumpFloodOutlinePass.mask";
    this.#maskMaterial.colorNode = vec4(maskColorNode, 1);

    this.#priorityMaskMaterial = new THREE.NodeMaterial();
    this.#priorityMaskMaterial.name = "JumpFloodOutlinePass.priorityMask";
    this.#priorityMaskMaterial.colorNode = vec4(maskColorNode, 1);
    this.#priorityMaskMaterial.depthTest = false;

    this.#seedPositionInitMaterial = new THREE.NodeMaterial();
    this.#seedPositionInitMaterial.name = "JumpFloodOutlinePass.seedPositionInit";
    this.#seedPositionInitMaterial.fragmentNode = buildSeedPositionInit(this.#maskTexture, resolutionNode);

    this.#seedColorInitMaterial = new THREE.NodeMaterial();
    this.#seedColorInitMaterial.name = "JumpFloodOutlinePass.seedColorInit";
    this.#seedColorInitMaterial.fragmentNode = this.#maskTexture;

    this.#prioritySeedPositionInitMaterial = new THREE.NodeMaterial();
    this.#prioritySeedPositionInitMaterial.name = "JumpFloodOutlinePass.prioritySeedPositionInit";
    this.#prioritySeedPositionInitMaterial.fragmentNode = buildSeedPositionInit(
      this.#priorityMaskTexture, resolutionNode
    );

    this.#prioritySeedColorInitMaterial = new THREE.NodeMaterial();
    this.#prioritySeedColorInitMaterial.name = "JumpFloodOutlinePass.prioritySeedColorInit";
    this.#prioritySeedColorInitMaterial.fragmentNode = this.#priorityMaskTexture;

    this.#isolatedSeedPositionInitMaterial = new THREE.NodeMaterial();
    this.#isolatedSeedPositionInitMaterial.name = "JumpFloodOutlinePass.isolatedSeedPositionInit";
    this.#isolatedSeedPositionInitMaterial.fragmentNode = buildSeedPositionInit(
      this.#isolatedMaskTexture, resolutionNode
    );

    this.#isolatedSeedColorInitMaterial = new THREE.NodeMaterial();
    this.#isolatedSeedColorInitMaterial.name = "JumpFloodOutlinePass.isolatedSeedColorInit";
    this.#isolatedSeedColorInitMaterial.fragmentNode = this.#isolatedMaskTexture;

    this.#jfaPositionStepMaterial = new THREE.NodeMaterial();
    this.#jfaPositionStepMaterial.name = "JumpFloodOutlinePass.jfaPositionStep";
    this.#jfaPositionStepMaterial.fragmentNode = buildJfaPositionStep(
      this.#jfaPositionSourceTexture, jfaStepNode, invSizeNode, resolutionNode
    );

    this.#jfaColorStepMaterial = new THREE.NodeMaterial();
    this.#jfaColorStepMaterial.name = "JumpFloodOutlinePass.jfaColorStep";
    this.#jfaColorStepMaterial.fragmentNode = buildJfaColorStep(
      this.#jfaPositionSourceTexture, this.#jfaColorSourceTexture, jfaStepNode, invSizeNode, resolutionNode
    );

    this.#jfaPriorityPositionStepMaterial = new THREE.NodeMaterial();
    this.#jfaPriorityPositionStepMaterial.name = "JumpFloodOutlinePass.jfaPriorityPositionStep";
    this.#jfaPriorityPositionStepMaterial.fragmentNode = buildJfaPositionStep(
      this.#jfaPriorityPositionSourceTexture, jfaStepNode, invSizeNode, resolutionNode
    );

    this.#jfaPriorityColorStepMaterial = new THREE.NodeMaterial();
    this.#jfaPriorityColorStepMaterial.name = "JumpFloodOutlinePass.jfaPriorityColorStep";
    this.#jfaPriorityColorStepMaterial.fragmentNode = buildJfaColorStep(
      this.#jfaPriorityPositionSourceTexture, this.#jfaPriorityColorSourceTexture, jfaStepNode, invSizeNode, resolutionNode
    );

    this.#jfaIsolatedPositionStepMaterial = new THREE.NodeMaterial();
    this.#jfaIsolatedPositionStepMaterial.name = "JumpFloodOutlinePass.jfaIsolatedPositionStep";
    this.#jfaIsolatedPositionStepMaterial.fragmentNode = buildJfaPositionStep(
      this.#jfaIsolatedPositionSourceTexture, jfaStepNode, invSizeNode, resolutionNode
    );

    this.#jfaIsolatedColorStepMaterial = new THREE.NodeMaterial();
    this.#jfaIsolatedColorStepMaterial.name = "JumpFloodOutlinePass.jfaIsolatedColorStep";
    this.#jfaIsolatedColorStepMaterial.fragmentNode = buildJfaColorStep(
      this.#jfaIsolatedPositionSourceTexture, this.#jfaIsolatedColorSourceTexture, jfaStepNode, invSizeNode, resolutionNode
    );

    // Ring shape: solid out to `ringThickness` pixels from the nearest
    // masked seed, ~1px smoothstep falloff past that, zeroed back out over
    // the entry's own rasterized pixels (`oneMinus(maskWeight(...))`) so the
    // ring only ever paints into the surrounding background - same role
    // `ColoredOutlinePass.#compositeMaterial`'s own `oneMinus(maskWeight(...))`
    // plays, just against a distance field instead of a blurred edge map.
    // `priorityRing`/`isolatedRing` are the same shape, each computed from
    // their own independent chain instead - `max()`, not `add()`, for the
    // same reason `ColoredOutlinePass.#compositeMaterial` uses it: at an
    // entry's own exposed boundary (the common case), multiple channels
    // independently detect essentially the same ring, and summing them would
    // double-brighten it for no reason. `hasPriorityNode`/`hasIsolatedNode`
    // zero their own channel out entirely on a frame with none of that kind
    // of entry - `#renderJumpFlood` skips re-running that chain's
    // propagation then, so without the gate a stale ring from whenever such
    // entries were last present could otherwise leak through forever.
    this.#compositeMaterial = new THREE.NodeMaterial();
    this.#compositeMaterial.name = "JumpFloodOutlinePass.composite";
    this.#compositeMaterial.fragmentNode = Fn(() => {
      const uvNode = uv();
      const pixelCoord = uvNode.mul(resolutionNode);
      const seedPos = this.#finalPositionTexture.sample(uvNode);
      const seedColor = this.#finalColorTexture.sample(uvNode);
      const dist = pixelCoord.sub(seedPos.xy).length();

      const ringShape = oneMinus(smoothstep(ringThicknessNode, ringThicknessNode.add(1), dist));
      const ring = ringShape.mul(oneMinus(maskWeight(this.#maskTexture.sample(uvNode))));

      const prioritySeedPos = this.#finalPriorityPositionTexture.sample(uvNode);
      const prioritySeedColor = this.#finalPriorityColorTexture.sample(uvNode);
      const priorityDist = pixelCoord.sub(prioritySeedPos.xy).length();

      const priorityRingShape = oneMinus(smoothstep(ringThicknessNode, ringThicknessNode.add(1), priorityDist));
      const priorityRing = priorityRingShape
        .mul(oneMinus(maskWeight(this.#priorityMaskTexture.sample(uvNode))))
        .mul(hasPriorityNode);

      const isolatedSeedPos = this.#finalIsolatedPositionTexture.sample(uvNode);
      const isolatedSeedColor = this.#finalIsolatedColorTexture.sample(uvNode);
      const isolatedDist = pixelCoord.sub(isolatedSeedPos.xy).length();

      const isolatedRingShape = oneMinus(smoothstep(ringThicknessNode, ringThicknessNode.add(1), isolatedDist));
      const isolatedRing = isolatedRingShape
        .mul(oneMinus(maskWeight(this.#isolatedMaskTexture.sample(uvNode))))
        .mul(hasIsolatedNode);

      const primary = max(vec4(seedColor.rgb, 1).mul(ring), vec4(prioritySeedColor.rgb, 1).mul(priorityRing));

      return max(primary, vec4(isolatedSeedColor.rgb, 1).mul(isolatedRing));
    })();

    this.#quad = new THREE.QuadMesh();

    this.pipeline = new THREE.RenderPipeline(renderer);
    this.pipeline.outputNode = this.#compositeTexture.add(scenePassNode);
  }

  get ringThickness(): number {
    return this.#ringThickness;
  }

  setRingThickness(
    ringThickness: number
  ): void {
    this.#ringThickness = ringThickness;
    this.#ringThicknessUniform.value = ringThickness;
  }

  /**
   * Replaces every currently outlined entry - same whole-object group
   * traversal `ColoredOutlinePass.setEntries` uses, and `priority`/`isolated`
   * are respected the same way that class does (see
   * `#renderTargetPriorityMask`'s/`#renderTargetIsolatedMask`'s own doc
   * comments) - only `instanceId` is silently ignored (unsupported in this
   * prototype - see this class's own doc comment).
   */
  setEntries(
    entries: ColoredOutlineEntry[]
  ): void {
    this.#entryByMesh.clear();
    this.#priorityMeshes.clear();
    this.#isolatedEntryByMesh.clear();

    for (const { target, color, priority = false, isolated = false } of entries) {
      const threeColor = color instanceof THREE.Color ? color.clone() : new THREE.Color(color);

      if (isolated) {
        target.traverse((object) => {
          if ((object as THREE.Mesh).isMesh) {
            this.#isolatedEntryByMesh.set(object as THREE.Mesh, threeColor);
          }
        });
        continue;
      }

      target.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) {
          const mesh = object as THREE.Mesh;
          this.#entryByMesh.set(mesh, threeColor);
          if (priority) {
            this.#priorityMeshes.add(mesh);
          }
        }
      });
    }
  }

  /**
   * Renders the mask + Jump Flood + composite chain for the current entries,
   * then the scene through the outline pipeline. Call this instead of
   * `renderer.render(scene, camera)` in the render loop.
   */
  render(): void {
    this.#renderJumpFlood();
    this.pipeline.render();
  }

  dispose(): void {
    this.#entryByMesh.clear();
    this.#priorityMeshes.clear();
    this.#isolatedEntryByMesh.clear();

    this.#renderTargetMask.dispose();
    this.#renderTargetSeedPosA.dispose();
    this.#renderTargetSeedPosB.dispose();
    this.#renderTargetSeedColorA.dispose();
    this.#renderTargetSeedColorB.dispose();
    this.#renderTargetComposite.dispose();
    this.#renderTargetPriorityMask.dispose();
    this.#renderTargetPrioritySeedPosA.dispose();
    this.#renderTargetPrioritySeedPosB.dispose();
    this.#renderTargetPrioritySeedColorA.dispose();
    this.#renderTargetPrioritySeedColorB.dispose();
    this.#renderTargetIsolatedMask.dispose();
    this.#renderTargetIsolatedSeedPosA.dispose();
    this.#renderTargetIsolatedSeedPosB.dispose();
    this.#renderTargetIsolatedSeedColorA.dispose();
    this.#renderTargetIsolatedSeedColorB.dispose();

    this.#maskMaterial.dispose();
    this.#priorityMaskMaterial.dispose();
    this.#seedPositionInitMaterial.dispose();
    this.#seedColorInitMaterial.dispose();
    this.#prioritySeedPositionInitMaterial.dispose();
    this.#prioritySeedColorInitMaterial.dispose();
    this.#jfaPositionStepMaterial.dispose();
    this.#jfaColorStepMaterial.dispose();
    this.#jfaPriorityPositionStepMaterial.dispose();
    this.#jfaPriorityColorStepMaterial.dispose();
    this.#isolatedSeedPositionInitMaterial.dispose();
    this.#isolatedSeedColorInitMaterial.dispose();
    this.#jfaIsolatedPositionStepMaterial.dispose();
    this.#jfaIsolatedColorStepMaterial.dispose();
    this.#compositeMaterial.dispose();

    this.pipeline.dispose();
  }

  #renderJumpFlood(): void {
    const renderer = this.#renderer;
    const scene = this.#scene;
    const camera = this.#camera;

    if (this.#entryByMesh.size === 0 && this.#isolatedEntryByMesh.size === 0) {
      if (this.#entryCount > 0) {
        this.#clearComposite();
        this.#entryCount = 0;
      }

      return;
    }
    this.#entryCount = this.#entryByMesh.size + this.#isolatedEntryByMesh.size;
    const hasPriority = this.#priorityMeshes.size > 0;
    this.#hasPriorityUniform.value = hasPriority ? 1 : 0;
    const hasIsolated = this.#isolatedEntryByMesh.size > 0;
    this.#hasIsolatedUniform.value = hasIsolated ? 1 : 0;

    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    const previousRenderObjectFunction = renderer.getRenderObjectFunction();
    const previousClearColor = new THREE.Color();
    renderer.getClearColor(previousClearColor);
    const previousClearAlpha = renderer.getClearAlpha();
    const previousBackground = scene.background;

    // Same reasoning as `ColoredOutlinePass.#renderMask` - an opaque scene
    // background forces a full clear on every `renderer.render()` call
    // regardless of `autoClear`, which would fight this mask pass's own
    // transparent clear.
    scene.background = null;

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.#setSize(size.width, size.height);

    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);

    renderer.setRenderObjectFunction((
      object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
      // eslint-disable-next-line max-params -- external callback contract, matches ColoredOutlinePass's own override
    ) => {
      const color = this.#entryByMesh.get(object as THREE.Mesh);
      if (color === undefined) {
        return;
      }

      this.#maskColor.copy(color);
      renderer.renderObject(object, objectScene, objectCamera, geometry, this.#maskMaterial, group, lightsNode, clippingContext);
    });

    renderer.setRenderTarget(this.#renderTargetMask);
    renderer.render(scene, camera);

    // Second pass: redraws every `priority` entry, without clearing the
    // target first, so priority always wins the shared mask buffer over
    // everything the first pass already drew wherever silhouettes overlap on
    // screen - see `#priorityMaskMaterial`'s own doc comment. Third pass:
    // the same override function (still active) redraws the same priority
    // entries again into their own fresh (cleared) target instead of
    // layering onto the shared mask - see `#renderTargetPriorityMask`'s own
    // doc comment for why this second, independent chain exists.
    if (hasPriority) {
      renderer.autoClear = false;
      renderer.setRenderObjectFunction((
        object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
        // eslint-disable-next-line max-params -- external callback contract, matches ColoredOutlinePass's own override
      ) => {
        const mesh = object as THREE.Mesh;
        if (!this.#priorityMeshes.has(mesh)) {
          return;
        }
        const color = this.#entryByMesh.get(mesh);
        if (color === undefined) {
          return;
        }

        this.#maskColor.copy(color);
        renderer.renderObject(
          object, objectScene, objectCamera, geometry, this.#priorityMaskMaterial, group, lightsNode, clippingContext
        );
      });
      renderer.render(scene, camera);

      renderer.autoClear = true;
      renderer.setRenderTarget(this.#renderTargetPriorityMask);
      renderer.render(scene, camera);
    }

    // Isolated entries: a single fresh `depthTest: false` pass, entirely
    // independent of the shared/priority mask above - no "layer onto the
    // shared mask" step at all, unlike priority, since an isolated entry was
    // never in `#entryByMesh` to begin with (see `setEntries`).
    if (hasIsolated) {
      renderer.autoClear = true;
      renderer.setRenderObjectFunction((
        object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
        // eslint-disable-next-line max-params -- external callback contract, matches ColoredOutlinePass's own override
      ) => {
        const color = this.#isolatedEntryByMesh.get(object as THREE.Mesh);
        if (color === undefined) {
          return;
        }

        this.#maskColor.copy(color);
        renderer.renderObject(
          object, objectScene, objectCamera, geometry, this.#priorityMaskMaterial, group, lightsNode, clippingContext
        );
      });
      renderer.setRenderTarget(this.#renderTargetIsolatedMask);
      renderer.render(scene, camera);
    }

    renderer.setRenderObjectFunction(previousRenderObjectFunction);

    // Restored here, not at the very end - see `ColoredOutlinePass.#renderMask`'s
    // own comment on why this specific ordering is what actually fixed a
    // real "whole 3D view turns white" bug: every quad step from here on
    // must see the caller's own scene background/clear state, not this mask
    // pass's transparent one.
    renderer.autoClear = previousAutoClear;
    renderer.setClearColor(previousClearColor, previousClearAlpha);
    scene.background = previousBackground;

    this.#quad.material = this.#seedPositionInitMaterial;
    renderer.setRenderTarget(this.#renderTargetSeedPosA);
    this.#quad.render(renderer);

    this.#quad.material = this.#seedColorInitMaterial;
    renderer.setRenderTarget(this.#renderTargetSeedColorA);
    this.#quad.render(renderer);

    if (hasPriority) {
      this.#quad.material = this.#prioritySeedPositionInitMaterial;
      renderer.setRenderTarget(this.#renderTargetPrioritySeedPosA);
      this.#quad.render(renderer);

      this.#quad.material = this.#prioritySeedColorInitMaterial;
      renderer.setRenderTarget(this.#renderTargetPrioritySeedColorA);
      this.#quad.render(renderer);
    }

    if (hasIsolated) {
      this.#quad.material = this.#isolatedSeedPositionInitMaterial;
      renderer.setRenderTarget(this.#renderTargetIsolatedSeedPosA);
      this.#quad.render(renderer);

      this.#quad.material = this.#isolatedSeedColorInitMaterial;
      renderer.setRenderTarget(this.#renderTargetIsolatedSeedColorA);
      this.#quad.render(renderer);
    }

    // Ping-pongs the A/B pairs across `#stepSizes`, alternating which one is
    // "source" (read by this iteration's shaders) vs "destination" (written
    // by it) - see this class's own doc comment. Starts with "A" as source
    // since the two init passes above just wrote there. The priority and
    // isolated chains (when present) propagate through the exact same
    // `#stepSizes` sequence, one iteration at a time alongside the primary
    // chain - all three share `#jfaStepUniform`, so there's no need for a
    // second/third loop.
    let sourceIsA = true;
    let prioritySourceIsA = true;
    let isolatedSourceIsA = true;
    for (const step of this.#stepSizes) {
      const positionSource = sourceIsA ? this.#renderTargetSeedPosA : this.#renderTargetSeedPosB;
      const positionDest = sourceIsA ? this.#renderTargetSeedPosB : this.#renderTargetSeedPosA;
      const colorSource = sourceIsA ? this.#renderTargetSeedColorA : this.#renderTargetSeedColorB;
      const colorDest = sourceIsA ? this.#renderTargetSeedColorB : this.#renderTargetSeedColorA;

      this.#jfaStepUniform.value = step;
      this.#jfaPositionSourceTexture.value = positionSource.texture;
      this.#jfaColorSourceTexture.value = colorSource.texture;

      this.#quad.material = this.#jfaPositionStepMaterial;
      renderer.setRenderTarget(positionDest);
      this.#quad.render(renderer);

      this.#quad.material = this.#jfaColorStepMaterial;
      renderer.setRenderTarget(colorDest);
      this.#quad.render(renderer);

      sourceIsA = !sourceIsA;

      if (hasPriority) {
        const priorityPositionSource = prioritySourceIsA
          ? this.#renderTargetPrioritySeedPosA : this.#renderTargetPrioritySeedPosB;
        const priorityPositionDest = prioritySourceIsA
          ? this.#renderTargetPrioritySeedPosB : this.#renderTargetPrioritySeedPosA;
        const priorityColorSource = prioritySourceIsA
          ? this.#renderTargetPrioritySeedColorA : this.#renderTargetPrioritySeedColorB;
        const priorityColorDest = prioritySourceIsA
          ? this.#renderTargetPrioritySeedColorB : this.#renderTargetPrioritySeedColorA;

        this.#jfaPriorityPositionSourceTexture.value = priorityPositionSource.texture;
        this.#jfaPriorityColorSourceTexture.value = priorityColorSource.texture;

        this.#quad.material = this.#jfaPriorityPositionStepMaterial;
        renderer.setRenderTarget(priorityPositionDest);
        this.#quad.render(renderer);

        this.#quad.material = this.#jfaPriorityColorStepMaterial;
        renderer.setRenderTarget(priorityColorDest);
        this.#quad.render(renderer);

        prioritySourceIsA = !prioritySourceIsA;
      }

      if (hasIsolated) {
        const isolatedPositionSource = isolatedSourceIsA
          ? this.#renderTargetIsolatedSeedPosA : this.#renderTargetIsolatedSeedPosB;
        const isolatedPositionDest = isolatedSourceIsA
          ? this.#renderTargetIsolatedSeedPosB : this.#renderTargetIsolatedSeedPosA;
        const isolatedColorSource = isolatedSourceIsA
          ? this.#renderTargetIsolatedSeedColorA : this.#renderTargetIsolatedSeedColorB;
        const isolatedColorDest = isolatedSourceIsA
          ? this.#renderTargetIsolatedSeedColorB : this.#renderTargetIsolatedSeedColorA;

        this.#jfaIsolatedPositionSourceTexture.value = isolatedPositionSource.texture;
        this.#jfaIsolatedColorSourceTexture.value = isolatedColorSource.texture;

        this.#quad.material = this.#jfaIsolatedPositionStepMaterial;
        renderer.setRenderTarget(isolatedPositionDest);
        this.#quad.render(renderer);

        this.#quad.material = this.#jfaIsolatedColorStepMaterial;
        renderer.setRenderTarget(isolatedColorDest);
        this.#quad.render(renderer);

        isolatedSourceIsA = !isolatedSourceIsA;
      }
    }

    this.#finalPositionTexture.value = (sourceIsA ? this.#renderTargetSeedPosA : this.#renderTargetSeedPosB).texture;
    this.#finalColorTexture.value = (sourceIsA ? this.#renderTargetSeedColorA : this.#renderTargetSeedColorB).texture;

    // Left stale (harmless) when `!hasPriority`/`!hasIsolated` -
    // `#compositeMaterial` gates each channel out entirely via
    // `hasPriorityNode`/`hasIsolatedNode` in that case, see its own doc
    // comment.
    if (hasPriority) {
      this.#finalPriorityPositionTexture.value = (
        prioritySourceIsA ? this.#renderTargetPrioritySeedPosA : this.#renderTargetPrioritySeedPosB
      ).texture;
      this.#finalPriorityColorTexture.value = (
        prioritySourceIsA ? this.#renderTargetPrioritySeedColorA : this.#renderTargetPrioritySeedColorB
      ).texture;
    }
    if (hasIsolated) {
      this.#finalIsolatedPositionTexture.value = (
        isolatedSourceIsA ? this.#renderTargetIsolatedSeedPosA : this.#renderTargetIsolatedSeedPosB
      ).texture;
      this.#finalIsolatedColorTexture.value = (
        isolatedSourceIsA ? this.#renderTargetIsolatedSeedColorA : this.#renderTargetIsolatedSeedColorB
      ).texture;
    }

    this.#quad.material = this.#compositeMaterial;
    renderer.setRenderTarget(this.#renderTargetComposite);
    this.#quad.render(renderer);

    renderer.setRenderTarget(previousTarget);
  }

  #clearComposite(): void {
    const renderer = this.#renderer;
    const previousTarget = renderer.getRenderTarget();
    const previousClearColor = new THREE.Color();
    renderer.getClearColor(previousClearColor);
    const previousClearAlpha = renderer.getClearAlpha();

    renderer.setRenderTarget(this.#renderTargetComposite);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();

    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(previousClearColor, previousClearAlpha);
  }

  #setSize(
    width: number,
    height: number
  ): void {
    if (this.#resolution.x === width && this.#resolution.y === height) {
      return;
    }

    this.#resolution.set(width, height);
    this.#invSize.set(1 / width, 1 / height);

    this.#renderTargetMask.setSize(width, height);
    this.#renderTargetComposite.setSize(width, height);
    this.#renderTargetSeedPosA.setSize(width, height);
    this.#renderTargetSeedPosB.setSize(width, height);
    this.#renderTargetSeedColorA.setSize(width, height);
    this.#renderTargetSeedColorB.setSize(width, height);
    this.#renderTargetPriorityMask.setSize(width, height);
    this.#renderTargetPrioritySeedPosA.setSize(width, height);
    this.#renderTargetPrioritySeedPosB.setSize(width, height);
    this.#renderTargetPrioritySeedColorA.setSize(width, height);
    this.#renderTargetPrioritySeedColorB.setSize(width, height);
    this.#renderTargetIsolatedMask.setSize(width, height);
    this.#renderTargetIsolatedSeedPosA.setSize(width, height);
    this.#renderTargetIsolatedSeedPosB.setSize(width, height);
    this.#renderTargetIsolatedSeedColorA.setSize(width, height);
    this.#renderTargetIsolatedSeedColorB.setSize(width, height);

    // Standard Jump Flood step sequence: the smallest power of two >= the
    // longest dimension, halved down to 1 (inclusive) - guarantees every
    // texel can reach a seed anywhere else in the buffer within this many
    // passes, same derivation any JFA implementation uses.
    this.#stepSizes = [];
    let step = 1;
    while (step < Math.max(width, height)) {
      step *= 2;
    }
    while (step >= 1) {
      this.#stepSizes.push(step);
      step = Math.floor(step / 2);
    }
  }
}
