// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  vec4,
  uniform,
  texture,
  pass
} from "three/tsl";

// Import Internal Dependencies
import type { HighlightEntry } from "./HighlightPass.ts";
import { InstancedHighlightMask } from "./InstancedHighlightMask.ts";
import { buildJfaSeedInit } from "./tsl/jfa/seed.ts";
import { buildJfaPropagateStep } from "./tsl/jfa/propagate.ts";
import { buildJfaRingComposite, type JfaRingChannel } from "./tsl/jfa/resolve.ts";
import type { TslNode } from "./tsl/tslNode.ts";

// CONSTANTS
// The isolated (hover) chain's own re-render interval (in frames) scales
// with canvas resolution rather than a fixed constant - see
// `#renderJumpFlood`. `kIsolatedRefreshIntervalBase` is what it reduces to
// at (or below) `kIsolatedRefreshIntervalReferencePixels` (1080p, tuned by
// feel); `kIsolatedRefreshIntervalMax` caps how large it can grow, so a
// very large canvas doesn't make the hover ring's staleness read as a pop.
const kIsolatedRefreshIntervalBase = 6;
const kIsolatedRefreshIntervalReferencePixels = 1920 * 1080;
const kIsolatedRefreshIntervalMax = 16;

export interface HighlightPassJfaOptions {
  /**
   * Ring thickness, in screen pixels - unlike `HighlightPass.edgeThickness`
   * (downsampled pixels, blur-kernel-radius-shaped), this is an exact,
   * resolution-independent pixel count: the Jump Flood distance field is a
   * real per-pixel distance to the silhouette, not a blur radius, so the
   * ring reads the same width at any viewing angle or downsample level.
   * @default 2
   */
  ringThickness?: number;
  /**
   * Solid black border, in screen pixels, drawn against an entry's own
   * silhouette before its assigned color - a peer-allocated color has no
   * guaranteed contrast with the mesh it lands on, so without this the
   * ring can be the only separation. Counted from the same seed distance
   * as `ringThickness`, so keep it smaller to leave any of the entry's own
   * color visible - see `tsl/jfa/resolve.ts` for the exact shape.
   * @default 1
   */
  borderThickness?: number;
  /**
   * Additive wash of the hoverer's own color across an `isolated` entry's
   * surface, `0`-`1` - a ring alone is a weak cue for a transient hover
   * nobody's necessarily already looking at. Never applied to
   * `priority`/shared entries. `0` disables it entirely.
   * @default 0.15
   */
  isolatedFillOpacity?: number;
}

/**
 * Jump Flood Algorithm alternative to `HighlightPass` - same
 * `HighlightEntry`/`setEntries` shape, so a caller can drive either
 * interchangeably, but replaces `HighlightPass`'s downsample/edge-detect/
 * blur chain with a real distance field: every background texel knows the
 * exact pixel-space distance to its nearest outlined silhouette, so the
 * ring reads the same width regardless of viewing angle or downsample
 * level.
 *
 * Same overall shape as `HighlightPass` (mask pass, `RenderPipeline`
 * compositing the ring onto a `pass(scene, camera)`):
 * 1. Mask pass - flat per-entry color, depth-tested.
 * 2. Seed init - every masked texel seeds itself (position, `valid = 1`,
 *    color) in one MRT draw; every other texel starts invalid.
 * 3. `O(log2(max(width, height)))` Jump Flood passes, each halving the
 *    sample step, propagating the nearest seed's position and color
 *    together in one MRT draw per step.
 * 4. Composite (`tsl/jfa/resolve.ts`) - a background texel within
 *    `ringThickness` of its nearest masked seed draws that seed's color,
 *    with a ~1px smoothstep falloff.
 *
 * Ping-pongs two independent render-target pairs (`#renderTargetSeedA`/`B`,
 * each a `count: 2` MRT target holding position in `textures[0]` and
 * color in `textures[1]`) across the Jump Flood passes, alternating source
 * vs destination each iteration - a texture can't be read and written in
 * the same GPU pass.
 *
 * @note
 * Requires `THREE.WebGPURenderer`. Owns its own `RenderPipeline` - pick one
 * whole-frame postprocess pipeline per scene, same caveat as
 * `HighlightPass`.
 *
 * @note
 * `priority`/`isolated`/`instanceId` entries work exactly like
 * `HighlightPass`'s own (see `HighlightEntry` and
 * `#renderTargetPriorityMask`/`#renderTargetIsolatedMask` below) - a
 * second and third independent mask/seed/propagate chain, same mechanism,
 * skipped entirely on a frame with none.
 */
export class HighlightPassJfa {
  readonly pipeline: THREE.RenderPipeline;

  #renderer: THREE.WebGPURenderer;
  #scene: THREE.Scene;
  #camera: THREE.Camera;

  #entryByMesh = new Map<THREE.Mesh, THREE.Color>();
  #lastEntryCount = 0;
  /**
   * The isolated chain's own seed/propagate work is a full second JFA
   * chain (same per-frame cost as the shared one) - a hover, driven
   * continuously by mouse movement, was roughly doubling the pass's
   * per-frame GPU cost. Since a hover ring doesn't need frame-perfect
   * precision, this throttles the isolated chain to re-render only every
   * so often (see `kIsolatedRefreshIntervalBase`), reusing the previous
   * frame's result the rest of the time. Set whenever the isolated
   * entries might have changed, so the next frame after a real change is
   * never stale.
   */
  #isolatedDirty = true;
  #isolatedFrameCounter = 0;
  /** Priority meshes, a subset of `#entryByMesh`'s own keys - see `#renderTargetPriorityMask`'s own doc comment. */
  #priorityMeshes = new Set<THREE.Mesh>();
  /** `isolated` entries land here instead - never part of `#entryByMesh` at all, see `#renderTargetIsolatedMask`'s own doc comment. */
  #isolatedEntryByMesh = new Map<THREE.Mesh, THREE.Color>();
  /** Entries with an `instanceId` set - see `InstancedHighlightMask`'s own doc comment. */
  #instancedMask = new InstancedHighlightMask();

  #ringThickness: number;
  /** See `HighlightPass.#edgeThicknessUniform`'s own doc comment for why every uniform field here is left without an explicit type annotation. */
  #ringThicknessUniform;
  #borderThickness: number;
  /** See `#ringThicknessUniform`'s own comment. */
  #borderThicknessUniform;
  #isolatedFillOpacity: number;
  /** See `#ringThicknessUniform`'s own comment. */
  #isolatedFillOpacityUniform;

  #resolution = new THREE.Vector2();
  #invSize = new THREE.Vector2();
  #resolutionUniform;
  #invSizeUniform;
  #maskColor = new THREE.Color();
  #maskColorUniform;
  /** `0`/`1` - gates the priority ring's own contribution in the composite; see `#hasPriorityUniform`'s own doc comment. */
  #hasPriorityUniform;
  /** Same role as `#hasPriorityUniform`, for the isolated channel. */
  #hasIsolatedUniform;

  /** Recomputed in `#setSize` - the standard JFA step sequence, largest power of two down to 1. */
  #stepSizes: number[] = [];
  /** Shared by all three propagation chains - all three progress through the same `#stepSizes` sequence in lockstep. */
  #jfaStepUniform;

  #renderTargetMask: THREE.RenderTarget;
  /**
   * `count: 2` MRT target - `textures[0]` is the position buffer
   * (`FloatType`, real precision needed for pixel-distance comparisons),
   * `textures[1]` the color buffer (default 8-bit - a display color needs
   * no float precision). One MRT draw per seed-init/propagate step writes
   * both at once, instead of two separate draws - see `buildJfaSeedInit`/
   * `buildJfaPropagateStep`.
   */
  #renderTargetSeedA: THREE.RenderTarget;
  #renderTargetSeedB: THREE.RenderTarget;
  #renderTargetComposite: THREE.RenderTarget;

  /**
   * Second, independent mask - only populated by `priority` entries,
   * always `depthTest: false` and always cleared fresh, never layered onto
   * the shared mask - same shape and reason as
   * `HighlightPass.#renderTargetPriorityMask`: the shared chain's own
   * composite only draws a ring into pixels it doesn't already claim, so a
   * priority entry entirely enclosed inside a larger, nearer silhouette
   * has nowhere to paint otherwise. Only built/run on a frame with at
   * least one `priority` entry.
   */
  #renderTargetPriorityMask: THREE.RenderTarget;
  /** Same shape as `#renderTargetSeedA`'s own doc comment, for the priority-only chain. */
  #renderTargetPrioritySeedA: THREE.RenderTarget;
  #renderTargetPrioritySeedB: THREE.RenderTarget;

  /**
   * Third, independent mask - only populated by `isolated` entries, same
   * shape as `#renderTargetPriorityMask` but for the opposite reason: an
   * isolated entry never redraws into the shared mask at all - isolated
   * meshes are simply never in `#entryByMesh` (see `setEntries`). Mirrors
   * the priority chain exactly.
   */
  #renderTargetIsolatedMask: THREE.RenderTarget;
  /** Same shape as `#renderTargetSeedA`'s own doc comment, for the isolated-only chain. */
  #renderTargetIsolatedSeedA: THREE.RenderTarget;
  #renderTargetIsolatedSeedB: THREE.RenderTarget;

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
  /** MRT material - writes both `#renderTargetSeedA`'s outputs in one draw, see its own doc comment. */
  #seedInitMaterial: THREE.NodeMaterial;
  /** MRT material - writes both of a `#renderTargetSeedA`/`B` pair's outputs in one draw per step. */
  #jfaStepMaterial: THREE.NodeMaterial;
  #compositeMaterial: THREE.NodeMaterial;

  /**
   * `depthTest: false` so a priority entry always wins the shared mask
   * buffer regardless of its actual distance from the camera - same
   * reasoning as `HighlightPass.#priorityMaskMaterial`'s own doc
   * comment. Reused for the shared mask's own second (layered) pass,
   * `#renderTargetPriorityMask`'s single (fresh) pass, and
   * `#renderTargetIsolatedMask`'s own single (fresh) pass - stateless, only
   * reads `maskColorNode`/depth-test state, so one material covers all three.
   */
  #priorityMaskMaterial: THREE.NodeMaterial;
  #prioritySeedInitMaterial: THREE.NodeMaterial;
  #jfaPriorityStepMaterial: THREE.NodeMaterial;

  #isolatedSeedInitMaterial: THREE.NodeMaterial;
  #jfaIsolatedStepMaterial: THREE.NodeMaterial;

  #quad: THREE.QuadMesh;

  constructor(
    renderer: THREE.WebGPURenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    options: HighlightPassJfaOptions = {}
  ) {
    const { ringThickness = 2, borderThickness = 1, isolatedFillOpacity = 0.15 } = options;

    this.#renderer = renderer;
    this.#scene = scene;
    this.#camera = camera;
    this.#ringThickness = ringThickness;
    this.#borderThickness = borderThickness;
    this.#isolatedFillOpacity = isolatedFillOpacity;

    this.#ringThicknessUniform = uniform(ringThickness);
    this.#borderThicknessUniform = uniform(borderThickness);
    this.#isolatedFillOpacityUniform = uniform(isolatedFillOpacity);
    this.#resolutionUniform = uniform(this.#resolution);
    this.#invSizeUniform = uniform(this.#invSize);
    this.#maskColorUniform = uniform(this.#maskColor);
    this.#jfaStepUniform = uniform(1);
    this.#hasPriorityUniform = uniform(0);
    this.#hasIsolatedUniform = uniform(0);

    const ringThicknessNode = this.#ringThicknessUniform;
    const borderThicknessNode = this.#borderThicknessUniform;
    const isolatedFillOpacityNode = this.#isolatedFillOpacityUniform;
    const resolutionNode = this.#resolutionUniform;
    const invSizeNode = this.#invSizeUniform;
    // See `HighlightPass`'s own matching comment - genuine reinterpretation,
    // not an inference workaround: built from a `THREE.Color` (so TSL infers
    // it as a `"color"` node), but every consumer below treats it as a plain
    // `"vec3"`.
    const maskColorNode = this.#maskColorUniform as TslNode<"vec3">;
    const jfaStepNode = this.#jfaStepUniform;
    const hasPriorityNode = this.#hasPriorityUniform;
    const hasIsolatedNode = this.#hasIsolatedUniform;

    // Every buffer below stores discrete, per-texel seed data (a pixel
    // coordinate, a valid flag, or a color tied to one seed) that later
    // passes re-sample at deliberately offset texel positions
    // (`buildJfaPropagateStep`'s 9-neighbor scan). `RenderTarget`'s default
    // `LinearFilter` blends two neighboring texels whenever the sampled UV
    // drifts even slightly off an exact texel center - harmless for a
    // color blur, but here it silently averages two different seeds'
    // positions into a meaningless coordinate, or blends a valid `1` flag
    // with a neighboring invalid `0` past the `greaterThan(0.5)` checks in
    // `buildJfaSeedInit`/`buildJfaPropagateStep`, dropping that seed.
    // Compounded over every ping-ponged pass, this reliably lost an entire
    // entry's ring whenever 2+ seeds shared a chain. `NearestFilter` reads
    // the nearest texel outright, so it can never blend across a seed
    // boundary.
    const nearestFilter = { magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter };

    this.#renderTargetMask = new THREE.RenderTarget(1, 1, nearestFilter);
    this.#renderTargetComposite = new THREE.RenderTarget(1, 1, { depthBuffer: false });

    this.#renderTargetSeedA = this.#createSeedRenderTarget(nearestFilter);
    this.#renderTargetSeedB = this.#createSeedRenderTarget(nearestFilter);

    // No depth buffer - always drawn `depthTest: false` (see
    // `#priorityMaskMaterial`'s own doc comment), so it never needs one.
    this.#renderTargetPriorityMask = new THREE.RenderTarget(1, 1, { depthBuffer: false, ...nearestFilter });
    this.#renderTargetPrioritySeedA = this.#createSeedRenderTarget(nearestFilter);
    this.#renderTargetPrioritySeedB = this.#createSeedRenderTarget(nearestFilter);

    // Same shape, for `isolated` entries - see `#renderTargetIsolatedMask`'s
    // own doc comment.
    this.#renderTargetIsolatedMask = new THREE.RenderTarget(1, 1, { depthBuffer: false, ...nearestFilter });
    this.#renderTargetIsolatedSeedA = this.#createSeedRenderTarget(nearestFilter);
    this.#renderTargetIsolatedSeedB = this.#createSeedRenderTarget(nearestFilter);

    this.#maskTexture = texture(this.#renderTargetMask.texture);
    this.#compositeTexture = texture(this.#renderTargetComposite.texture);
    this.#jfaPositionSourceTexture = texture(this.#renderTargetSeedA.textures[0]);
    this.#jfaColorSourceTexture = texture(this.#renderTargetSeedA.textures[1]);
    this.#finalPositionTexture = texture(this.#renderTargetSeedA.textures[0]);
    this.#finalColorTexture = texture(this.#renderTargetSeedA.textures[1]);

    this.#priorityMaskTexture = texture(this.#renderTargetPriorityMask.texture);
    this.#jfaPriorityPositionSourceTexture = texture(this.#renderTargetPrioritySeedA.textures[0]);
    this.#jfaPriorityColorSourceTexture = texture(this.#renderTargetPrioritySeedA.textures[1]);
    this.#finalPriorityPositionTexture = texture(this.#renderTargetPrioritySeedA.textures[0]);
    this.#finalPriorityColorTexture = texture(this.#renderTargetPrioritySeedA.textures[1]);

    this.#isolatedMaskTexture = texture(this.#renderTargetIsolatedMask.texture);
    this.#jfaIsolatedPositionSourceTexture = texture(this.#renderTargetIsolatedSeedA.textures[0]);
    this.#jfaIsolatedColorSourceTexture = texture(this.#renderTargetIsolatedSeedA.textures[1]);
    this.#finalIsolatedPositionTexture = texture(this.#renderTargetIsolatedSeedA.textures[0]);
    this.#finalIsolatedColorTexture = texture(this.#renderTargetIsolatedSeedA.textures[1]);

    const scenePassNode = pass(scene, camera);

    this.#maskMaterial = new THREE.NodeMaterial();
    this.#maskMaterial.name = "HighlightPassJfa.mask";
    this.#maskMaterial.colorNode = vec4(maskColorNode, 1);

    this.#priorityMaskMaterial = new THREE.NodeMaterial();
    this.#priorityMaskMaterial.name = "HighlightPassJfa.priorityMask";
    this.#priorityMaskMaterial.colorNode = vec4(maskColorNode, 1);
    this.#priorityMaskMaterial.depthTest = false;

    this.#seedInitMaterial = new THREE.NodeMaterial();
    this.#seedInitMaterial.name = "HighlightPassJfa.seedInit";
    this.#seedInitMaterial.fragmentNode = buildJfaSeedInit(this.#maskTexture, resolutionNode);

    this.#prioritySeedInitMaterial = new THREE.NodeMaterial();
    this.#prioritySeedInitMaterial.name = "HighlightPassJfa.prioritySeedInit";
    this.#prioritySeedInitMaterial.fragmentNode = buildJfaSeedInit(this.#priorityMaskTexture, resolutionNode);

    this.#isolatedSeedInitMaterial = new THREE.NodeMaterial();
    this.#isolatedSeedInitMaterial.name = "HighlightPassJfa.isolatedSeedInit";
    this.#isolatedSeedInitMaterial.fragmentNode = buildJfaSeedInit(this.#isolatedMaskTexture, resolutionNode);

    this.#jfaStepMaterial = new THREE.NodeMaterial();
    this.#jfaStepMaterial.name = "HighlightPassJfa.jfaStep";
    this.#jfaStepMaterial.fragmentNode = buildJfaPropagateStep(
      this.#jfaPositionSourceTexture, this.#jfaColorSourceTexture, jfaStepNode, invSizeNode, resolutionNode
    );

    this.#jfaPriorityStepMaterial = new THREE.NodeMaterial();
    this.#jfaPriorityStepMaterial.name = "HighlightPassJfa.jfaPriorityStep";
    this.#jfaPriorityStepMaterial.fragmentNode = buildJfaPropagateStep(
      this.#jfaPriorityPositionSourceTexture, this.#jfaPriorityColorSourceTexture, jfaStepNode, invSizeNode, resolutionNode
    );

    this.#jfaIsolatedStepMaterial = new THREE.NodeMaterial();
    this.#jfaIsolatedStepMaterial.name = "HighlightPassJfa.jfaIsolatedStep";
    this.#jfaIsolatedStepMaterial.fragmentNode = buildJfaPropagateStep(
      this.#jfaIsolatedPositionSourceTexture, this.#jfaIsolatedColorSourceTexture, jfaStepNode, invSizeNode, resolutionNode
    );

    const sharedChannel: JfaRingChannel = {
      positionTexture: this.#finalPositionTexture, colorTexture: this.#finalColorTexture, maskTexture: this.#maskTexture
    };
    const priorityChannel: JfaRingChannel = {
      positionTexture: this.#finalPriorityPositionTexture,
      colorTexture: this.#finalPriorityColorTexture,
      maskTexture: this.#priorityMaskTexture
    };
    const isolatedChannel: JfaRingChannel = {
      positionTexture: this.#finalIsolatedPositionTexture,
      colorTexture: this.#finalIsolatedColorTexture,
      maskTexture: this.#isolatedMaskTexture
    };

    this.#compositeMaterial = new THREE.NodeMaterial();
    this.#compositeMaterial.name = "HighlightPassJfa.composite";
    this.#compositeMaterial.fragmentNode = buildJfaRingComposite(
      {
        resolutionNode, ringThicknessNode, borderThicknessNode, isolatedFillOpacityNode, hasPriorityNode, hasIsolatedNode
      },
      sharedChannel,
      priorityChannel,
      isolatedChannel
    );

    this.#quad = new THREE.QuadMesh();

    this.pipeline = new THREE.RenderPipeline(renderer);
    this.pipeline.outputNode = this.#compositeTexture.add(scenePassNode);
  }

  /**
   * One `count: 2` MRT render target for a seed/propagate chain's position
   * + color buffers - sharing a target is what lets `buildJfaSeedInit`/
   * `buildJfaPropagateStep` write both in a single draw. `textures[0]`/`[1]`
   * need `.name`s (`"position"`/`"color"`) matching the `mrt({...})` keys
   * those functions return, so the backend's name-matched MRT routing
   * lands each output correctly.
   */
  #createSeedRenderTarget(
    nearestFilter: { magFilter: THREE.MagnificationTextureFilter; minFilter: THREE.MinificationTextureFilter; }
  ): THREE.RenderTarget {
    // `FloatType` uniformly for both attachments at construction (`count`
    // render targets share one `type` up front) - position needs real
    // float precision for distance comparisons; color doesn't, and the
    // MRT shader-output type is derived per-texture from each attachment's
    // own `.type` regardless of construction, so overriding color back
    // down afterward is safe and roughly halves its memory/bandwidth cost.
    const target = new THREE.RenderTarget(1, 1, {
      depthBuffer: false, type: THREE.FloatType, count: 2, ...nearestFilter
    });
    target.textures[0].name = "position";
    target.textures[1].name = "color";

    return target;
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

  get borderThickness(): number {
    return this.#borderThickness;
  }

  setBorderThickness(
    borderThickness: number
  ): void {
    this.#borderThickness = borderThickness;
    this.#borderThicknessUniform.value = borderThickness;
  }

  get isolatedFillOpacity(): number {
    return this.#isolatedFillOpacity;
  }

  setIsolatedFillOpacity(
    isolatedFillOpacity: number
  ): void {
    this.#isolatedFillOpacity = isolatedFillOpacity;
    this.#isolatedFillOpacityUniform.value = isolatedFillOpacity;
  }

  /**
   * Replaces every currently outlined entry - same whole-object group
   * traversal `HighlightPass.setEntries` uses, and `priority`/`isolated`/
   * `instanceId` are respected the same way.
   */
  setEntries(
    entries: HighlightEntry[]
  ): void {
    // Any call could change the isolated set's composition - see
    // `#isolatedDirty`'s own doc comment.
    this.#isolatedDirty = true;

    this.#entryByMesh.clear();
    this.#priorityMeshes.clear();
    this.#isolatedEntryByMesh.clear();
    this.#instancedMask.clear();

    for (const { target, color, priority = false, isolated = false, instanceId } of entries) {
      const threeColor = color instanceof THREE.Color ? color.clone() : new THREE.Color(color);

      if (instanceId !== undefined) {
        this.#instancedMask.add(target as THREE.InstancedMesh, instanceId, threeColor, priority);
        continue;
      }

      if (isolated) {
        target.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            this.#isolatedEntryByMesh.set(object, threeColor);
          }
        });
        continue;
      }

      target.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          this.#entryByMesh.set(object, threeColor);
          if (priority) {
            this.#priorityMeshes.add(object);
          }
        }
      });
    }

    this.#instancedMask.sync();
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
    this.#instancedMask.dispose();

    this.#renderTargetMask.dispose();
    this.#renderTargetSeedA.dispose();
    this.#renderTargetSeedB.dispose();
    this.#renderTargetComposite.dispose();
    this.#renderTargetPriorityMask.dispose();
    this.#renderTargetPrioritySeedA.dispose();
    this.#renderTargetPrioritySeedB.dispose();
    this.#renderTargetIsolatedMask.dispose();
    this.#renderTargetIsolatedSeedA.dispose();
    this.#renderTargetIsolatedSeedB.dispose();

    this.#maskMaterial.dispose();
    this.#priorityMaskMaterial.dispose();
    this.#seedInitMaterial.dispose();
    this.#prioritySeedInitMaterial.dispose();
    this.#jfaStepMaterial.dispose();
    this.#jfaPriorityStepMaterial.dispose();
    this.#isolatedSeedInitMaterial.dispose();
    this.#jfaIsolatedStepMaterial.dispose();
    this.#compositeMaterial.dispose();

    this.pipeline.dispose();
  }

  #renderJumpFlood(): void {
    const renderer = this.#renderer;
    const scene = this.#scene;
    const camera = this.#camera;

    if (this.#entryByMesh.size === 0 && this.#isolatedEntryByMesh.size === 0 && this.#instancedMask.size === 0) {
      if (this.#lastEntryCount > 0) {
        this.#clearComposite();
        this.#lastEntryCount = 0;
      }

      return;
    }
    this.#lastEntryCount = this.#entryByMesh.size + this.#isolatedEntryByMesh.size + this.#instancedMask.size;
    const hasPriority = this.#priorityMeshes.size > 0 || this.#instancedMask.size > 0;
    this.#hasPriorityUniform.value = hasPriority ? 1 : 0;
    const isolatedPresent = this.#isolatedEntryByMesh.size > 0;
    this.#hasIsolatedUniform.value = isolatedPresent ? 1 : 0;

    // Fetched up front - JFA's cost scales with pixel count, and this
    // chain re-renders on nearly every mouse-move frame, so a fixed
    // refresh interval tuned for one canvas size under-throttles a larger
    // one. Scaling the interval with pixel count keeps the total
    // per-second isolated-chain cost roughly constant across canvas sizes -
    // see `kIsolatedRefreshIntervalBase` for the formula.
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const isolatedResolutionScale = Math.max(1, (size.width * size.height) / kIsolatedRefreshIntervalReferencePixels);
    const isolatedRefreshInterval = Math.min(
      kIsolatedRefreshIntervalMax,
      Math.round(kIsolatedRefreshIntervalBase * isolatedResolutionScale)
    );

    // Throttled version of `isolatedPresent`: gates the actual isolated
    // seed/propagate work below (see `#isolatedDirty`). The composite gate
    // above always reflects real presence, so a skipped frame keeps
    // showing the ring, just with up-to-`isolatedRefreshInterval - 1`-
    // frame-old data - never a visible pop from throttling alone.
    let hasIsolated = false;
    if (isolatedPresent) {
      this.#isolatedFrameCounter++;
      hasIsolated = this.#isolatedDirty || this.#isolatedFrameCounter % isolatedRefreshInterval === 0;
      if (hasIsolated) {
        this.#isolatedDirty = false;
      }
    }

    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    const previousRenderObjectFunction = renderer.getRenderObjectFunction();
    const previousClearColor = new THREE.Color();
    renderer.getClearColor(previousClearColor);
    const previousClearAlpha = renderer.getClearAlpha();
    const previousBackground = scene.background;

    // Same reasoning as `HighlightPass.#renderMask` - an opaque scene
    // background forces a full clear on every `renderer.render()` call
    // regardless of `autoClear`, which would fight this mask pass's own
    // transparent clear.
    scene.background = null;

    this.#setSize(size.width, size.height);

    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);

    renderer.setRenderObjectFunction((
      object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
      // eslint-disable-next-line max-params -- external callback contract, matches HighlightPass's own override
    ) => {
      if (object instanceof THREE.InstancedMesh) {
        const instanced = this.#instancedMask.materialsFor(object);
        if (instanced) {
          renderer.renderObject(
            object, objectScene, objectCamera, geometry, instanced.material, group, lightsNode, clippingContext
          );

          return;
        }
      }

      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      const color = this.#entryByMesh.get(object);
      if (color === undefined) {
        return;
      }

      this.#maskColor.copy(color);
      renderer.renderObject(object, objectScene, objectCamera, geometry, this.#maskMaterial, group, lightsNode, clippingContext);
    });

    renderer.setRenderTarget(this.#renderTargetMask);
    renderer.render(scene, camera);

    // Second pass: redraws every `priority` entry (and every
    // `InstancedMesh` with an instanced entry - `priorityMaterial`
    // discards non-priority instance fragments itself), without clearing
    // the target first, so priority always wins the shared mask wherever
    // silhouettes overlap. Third pass: the same override function (still
    // active) redraws the same priority entries into their own fresh
    // target instead of layering onto the shared mask - see
    // `#renderTargetPriorityMask` for why.
    if (hasPriority) {
      renderer.autoClear = false;
      renderer.setRenderObjectFunction((
        object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
        // eslint-disable-next-line max-params -- external callback contract, matches HighlightPass's own override
      ) => {
        if (object instanceof THREE.InstancedMesh) {
          const instanced = this.#instancedMask.materialsFor(object);
          if (instanced) {
            renderer.renderObject(
              object, objectScene, objectCamera, geometry, instanced.priorityMaterial, group, lightsNode, clippingContext
            );

            return;
          }
        }

        if (!(object instanceof THREE.Mesh) || !this.#priorityMeshes.has(object)) {
          return;
        }
        const color = this.#entryByMesh.get(object);
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
        // eslint-disable-next-line max-params -- external callback contract, matches HighlightPass's own override
      ) => {
        if (!(object instanceof THREE.Mesh)) {
          return;
        }
        const color = this.#isolatedEntryByMesh.get(object);
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

    // Restored here, not at the end - see `HighlightPass.#renderMask` for
    // why this ordering fixed a real "whole 3D view turns white" bug.
    renderer.autoClear = previousAutoClear;
    renderer.setClearColor(previousClearColor, previousClearAlpha);
    scene.background = previousBackground;

    this.#quad.material = this.#seedInitMaterial;
    renderer.setRenderTarget(this.#renderTargetSeedA);
    this.#quad.render(renderer);

    if (hasPriority) {
      this.#quad.material = this.#prioritySeedInitMaterial;
      renderer.setRenderTarget(this.#renderTargetPrioritySeedA);
      this.#quad.render(renderer);
    }

    if (hasIsolated) {
      this.#quad.material = this.#isolatedSeedInitMaterial;
      renderer.setRenderTarget(this.#renderTargetIsolatedSeedA);
      this.#quad.render(renderer);
    }

    // Ping-pongs the A/B pairs across `#stepSizes`, alternating source vs
    // destination each iteration - starts with "A" as source since init
    // just wrote there. The priority and isolated chains (when present)
    // propagate through the same `#stepSizes` sequence in lockstep, all
    // sharing `#jfaStepUniform`. Each iteration is one MRT draw per chain
    // (position + color together), not two.
    let sourceIsA = true;
    let prioritySourceIsA = true;
    let isolatedSourceIsA = true;
    for (const step of this.#stepSizes) {
      const source = sourceIsA ? this.#renderTargetSeedA : this.#renderTargetSeedB;
      const dest = sourceIsA ? this.#renderTargetSeedB : this.#renderTargetSeedA;

      this.#jfaStepUniform.value = step;
      this.#jfaPositionSourceTexture.value = source.textures[0];
      this.#jfaColorSourceTexture.value = source.textures[1];

      this.#quad.material = this.#jfaStepMaterial;
      renderer.setRenderTarget(dest);
      this.#quad.render(renderer);

      sourceIsA = !sourceIsA;

      if (hasPriority) {
        const prioritySource = prioritySourceIsA ? this.#renderTargetPrioritySeedA : this.#renderTargetPrioritySeedB;
        const priorityDest = prioritySourceIsA ? this.#renderTargetPrioritySeedB : this.#renderTargetPrioritySeedA;

        this.#jfaPriorityPositionSourceTexture.value = prioritySource.textures[0];
        this.#jfaPriorityColorSourceTexture.value = prioritySource.textures[1];

        this.#quad.material = this.#jfaPriorityStepMaterial;
        renderer.setRenderTarget(priorityDest);
        this.#quad.render(renderer);

        prioritySourceIsA = !prioritySourceIsA;
      }

      if (hasIsolated) {
        const isolatedSource = isolatedSourceIsA ? this.#renderTargetIsolatedSeedA : this.#renderTargetIsolatedSeedB;
        const isolatedDest = isolatedSourceIsA ? this.#renderTargetIsolatedSeedB : this.#renderTargetIsolatedSeedA;

        this.#jfaIsolatedPositionSourceTexture.value = isolatedSource.textures[0];
        this.#jfaIsolatedColorSourceTexture.value = isolatedSource.textures[1];

        this.#quad.material = this.#jfaIsolatedStepMaterial;
        renderer.setRenderTarget(isolatedDest);
        this.#quad.render(renderer);

        isolatedSourceIsA = !isolatedSourceIsA;
      }
    }

    const finalTarget = sourceIsA ? this.#renderTargetSeedA : this.#renderTargetSeedB;
    this.#finalPositionTexture.value = finalTarget.textures[0];
    this.#finalColorTexture.value = finalTarget.textures[1];

    // Left stale (harmless) when `!hasPriority`/`!hasIsolated` -
    // `#compositeMaterial` gates each channel out entirely via
    // `hasPriorityNode`/`hasIsolatedNode` in that case, see its own doc
    // comment.
    if (hasPriority) {
      const finalPriorityTarget = prioritySourceIsA ? this.#renderTargetPrioritySeedA : this.#renderTargetPrioritySeedB;
      this.#finalPriorityPositionTexture.value = finalPriorityTarget.textures[0];
      this.#finalPriorityColorTexture.value = finalPriorityTarget.textures[1];
    }
    if (hasIsolated) {
      const finalIsolatedTarget = isolatedSourceIsA ? this.#renderTargetIsolatedSeedA : this.#renderTargetIsolatedSeedB;
      this.#finalIsolatedPositionTexture.value = finalIsolatedTarget.textures[0];
      this.#finalIsolatedColorTexture.value = finalIsolatedTarget.textures[1];
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
    this.#renderTargetSeedA.setSize(width, height);
    this.#renderTargetSeedB.setSize(width, height);
    this.#renderTargetPriorityMask.setSize(width, height);
    this.#renderTargetPrioritySeedA.setSize(width, height);
    this.#renderTargetPrioritySeedB.setSize(width, height);
    this.#renderTargetIsolatedMask.setSize(width, height);
    this.#renderTargetIsolatedSeedA.setSize(width, height);
    this.#renderTargetIsolatedSeedB.setSize(width, height);

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
