// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  float,
  vec4,
  uniform,
  texture,
  pass
} from "three/tsl";

// Import Internal Dependencies
import type { SelectableObject } from "../SelectionManager.ts";
import { MAX_BLUR_RADIUS, buildSeparableBlur } from "./tsl/gaussianBlur.ts";
import { buildEdgeDetection } from "./tsl/edgeDetection.ts";
import { buildHighlightComposite } from "./tsl/composite.ts";
import { InstancedHighlightMask } from "./InstancedHighlightMask.ts";
import type { TslNode } from "./tsl/tslNode.ts";

export interface HighlightEntry {
  /**
   * Mesh (or group, traversed to every mesh inside it - same convention
   * three's own `OutlineNode` uses) to outline.
   */
  target: SelectableObject;
  /**
   * This entry's own outline color - every entry carries its own color
   * rather than sharing one or two fixed roles.
   */
  color: THREE.ColorRepresentation;
  /**
   * When two entries' silhouettes overlap on screen, the shared mask's
   * normal depth test lets whichever entry is nearer the camera win -
   * often not what's wanted (e.g. the local user's own selection should
   * stay visible even behind a peer's). Setting this draws the entry again
   * in a second, `depthTest: false` pass after every non-priority entry,
   * so it always wins the overlap regardless of traversal order or depth.
   *
   * That alone isn't enough if the entry's silhouette ends up entirely
   * enclosed inside a larger, nearer non-priority silhouette - the
   * composite step only draws a ring into background-adjacent pixels, so
   * a boundary that never touches real background has nowhere to paint
   * even after winning the mask color. A priority entry therefore also
   * gets its own independent, self-only mask/edge-detect chain (see
   * `#renderTargetPriorityMask`) that guarantees its ring is visible
   * regardless of what surrounds it.
   * @default false
   */
  priority?: boolean;
  /**
   * The opposite of `priority`: this entry's ring is drawn complete, from
   * its own dedicated mask, entirely independent of every other entry - it
   * never competes for the shared mask, so it can neither be cut by
   * another entry nor cut one itself by winning an ordinary depth test.
   * Typical use: a transient hover preview, which shouldn't clip a peer's
   * selection ring just because it's nearer the camera right now.
   * Mutually exclusive with `priority` in practice. Pays for its own
   * mask/edge-detect chain (see `#renderTargetIsolatedMask`), skipped
   * entirely on a frame with none. Not supported alongside `instanceId`
   * (ignored there).
   * @default false
   */
  isolated?: boolean;
  /**
   * Selects a single instance of a `THREE.InstancedMesh` `target`, instead
   * of the whole object - required when `target` is a `THREE.InstancedMesh`
   * (which has no meaningful "whole object" mask) and must be omitted
   * otherwise. See `InstancedHighlightMask` for how outlining many
   * instances of the same mesh still costs only two draw calls total.
   */
  instanceId?: number;
}

export interface HighlightPassOptions {
  /**
   * Detected-edge thickness, in downsampled pixels.
   * @default 1
   */
  edgeThickness?: number;
  /**
   * Animated glow/pulse multiplier on the blurred outer ring.
   * @default 0
   */
  edgeGlow?: number;
  /**
   * Resolution divisor the edge-detection/blur passes run at.
   * @default 2
   */
  downSampleRatio?: number;
}

/**
 * Scene-level postprocess outline that renders many simultaneously
 * outlined objects, each in its own arbitrary color, in a single shared
 * mask + edge-detection pass - the same general shape as three's own
 * stock `OutlineNode` (mask, edge-detect, blur, composite), generalized to
 * an arbitrary per-entry color and without `OutlineNode`'s own expensive
 * non-selected-scene depth pre-pass.
 *
 * Never re-renders the rest of the scene: its mask pass draws only the
 * objects in `setEntries`, via the same `renderer.setRenderObjectFunction`
 * override technique `OutlineNode` uses. Cost scales with how many
 * outlined objects are visible this frame, not total scene size or peer
 * count.
 *
 * Has no notion of peers, `SelectionManager`, or `PeerSelectionRegistry` -
 * it only paints colored outlines around whatever `{ target, color }`
 * entries it's given. `PeerHighlightPass` is the thin adapter that feeds
 * it from the selection system.
 *
 * One of two selectable "highlight" techniques - see `HighlightPassJfa`
 * for a Jump Flood Algorithm-based alternative deriving a real per-pixel
 * distance field instead of this class's blurred edge map. Both share the
 * same `HighlightEntry`/`setEntries` shape.
 *
 * @note
 * Requires `THREE.WebGPURenderer`. Owns its own `RenderPipeline` -
 * `RenderPipeline.outputNode` is a single composed graph per instance, so
 * this can't be composited into the same frame as another whole-frame
 * postprocess pipeline; pick one per scene.
 *
 * @note
 * Not occlusion-aware, deliberately: a ring always draws at full, uniform
 * strength around its own silhouette regardless of what's in front of it -
 * effectively permanent x-ray for every entry. Two occlusion-aware designs
 * (a direct depth compare, and a bounded search propagating that compare
 * toward the ring) were built and reverted: both produced a "hidden,
 * dimmed" ring segment that read as two intensities stitched together at
 * a seam, worse for legibility than never dimming. No scene depth is read
 * anywhere in this class as a result - `pass(scene, camera)` is used only
 * for its color output.
 *
 * @note
 * See `HighlightEntry.priority`/`.isolated`/`.instanceId` for the entry
 * flags that drive this pass's second and third independent mask chains.
 */
export class HighlightPass {
  readonly pipeline: THREE.RenderPipeline;

  #renderer: THREE.WebGPURenderer;
  #scene: THREE.Scene;
  #camera: THREE.Camera;
  #downSampleRatio: number;

  #entryByMesh = new Map<THREE.Mesh, THREE.Color>();
  #priorityMeshes = new Set<THREE.Mesh>();
  /**
   * `isolated` entries land here instead of `#entryByMesh` - never part of
   * the shared mask's own pool, see `HighlightEntry.isolated`.
   */
  #isolatedEntryByMesh = new Map<THREE.Mesh, THREE.Color>();
  /**
   * Entries with an `instanceId` land here instead of `#entryByMesh` - a
   * per-instance mask needs dedicated GPU resources per `InstancedMesh`.
   */
  #instancedMask = new InstancedHighlightMask();
  #lastEntryCount = 0;

  #edgeThickness: number;
  #edgeGlow: number;
  /**
   * No explicit type annotation, deliberately - `uniform()`'s overloaded
   * signature only resolves to the concrete node type (e.g.
   * `UniformNode<"float", number>`) when TypeScript infers it from the
   * call itself; annotating here would force the generic fallback instead
   * (see `TslNode`), unusable as both a `.value` setter target and a
   * `TslNode<T>` argument to the `tsl/*.ts` builders below.
   */
  #edgeThicknessUniform;
  #edgeGlowUniform;

  /**
   * Plain instances kept alongside (not read back from) the matching
   * uniform above - the exact object `uniform()` stores as `.value` (by
   * reference), so mutating these in place updates what the GPU reads.
   */
  #blurDirection = new THREE.Vector2();
  #invSize = new THREE.Vector2();
  #maskColor = new THREE.Color();
  /** See `#edgeThicknessUniform`'s own doc comment for why these are left without an explicit type annotation. */
  #blurDirectionUniform;
  #invSizeUniform;
  #maskColorUniform;

  #renderTargetMask: THREE.RenderTarget;
  #renderTargetMaskDownSample: THREE.RenderTarget;
  #renderTargetEdge1: THREE.RenderTarget;
  #renderTargetEdge2: THREE.RenderTarget;
  #renderTargetBlur1: THREE.RenderTarget;
  #renderTargetBlur2: THREE.RenderTarget;
  #renderTargetComposite: THREE.RenderTarget;

  /**
   * Second, independent mask - only populated by `priority` entries,
   * always `depthTest: false` and always cleared fresh, never layered onto
   * the shared mask. Mirrors the shared mask's own
   * downsample/edge-detect/blur chain, reusing the same blur materials
   * (parameterized by `#blurSourceTexture`'s mutable `.value`) but its own
   * copy/edge-detection materials, since those hardcode which texture they
   * read from.
   *
   * Exists because the shared mask's composite step only draws a ring into
   * pixels the shared mask doesn't already claim (see `tsl/composite.ts`) -
   * a priority entry's ring has nowhere to paint once its silhouette sits
   * entirely inside a larger, nearer non-priority silhouette, even though
   * the shared mask already gave it the right color underneath. This
   * second mask is excluded only by its own silhouette, so its ring always
   * has somewhere to go - see `HighlightEntry.priority`.
   */
  #renderTargetPriorityMask: THREE.RenderTarget;
  #renderTargetPriorityMaskDownSample: THREE.RenderTarget;
  #renderTargetPriorityEdge1: THREE.RenderTarget;
  #renderTargetPriorityEdge2: THREE.RenderTarget;
  #renderTargetPriorityBlur1: THREE.RenderTarget;
  #renderTargetPriorityBlur2: THREE.RenderTarget;

  /**
   * Third, independent mask - only populated by `isolated` entries, same
   * shape as `#renderTargetPriorityMask` but for the opposite reason: an
   * isolated entry never redraws into the shared mask at all, so there's
   * no "wins the shared mask" pass feeding this one - isolated meshes are
   * simply never in `#entryByMesh` (see `setEntries`). Mirrors the
   * priority chain exactly, reusing the same blur materials.
   */
  #renderTargetIsolatedMask: THREE.RenderTarget;
  #renderTargetIsolatedMaskDownSample: THREE.RenderTarget;
  #renderTargetIsolatedEdge1: THREE.RenderTarget;
  #renderTargetIsolatedEdge2: THREE.RenderTarget;
  #renderTargetIsolatedBlur1: THREE.RenderTarget;
  #renderTargetIsolatedBlur2: THREE.RenderTarget;

  #maskTexture: ReturnType<typeof texture>;
  #maskDownSampleTexture: ReturnType<typeof texture>;
  #blurSourceTexture: ReturnType<typeof texture>;
  #edge1Texture: ReturnType<typeof texture>;
  #edge2Texture: ReturnType<typeof texture>;
  #compositeTexture: ReturnType<typeof texture>;

  #priorityMaskTexture: ReturnType<typeof texture>;
  #priorityMaskDownSampleTexture: ReturnType<typeof texture>;
  #priorityEdge1Texture: ReturnType<typeof texture>;
  #priorityEdge2Texture: ReturnType<typeof texture>;

  #isolatedMaskTexture: ReturnType<typeof texture>;
  #isolatedMaskDownSampleTexture: ReturnType<typeof texture>;
  #isolatedEdge1Texture: ReturnType<typeof texture>;
  #isolatedEdge2Texture: ReturnType<typeof texture>;

  #maskMaterial: THREE.NodeMaterial;
  #priorityMaskMaterial: THREE.NodeMaterial;
  #copyMaterial: THREE.NodeMaterial;
  #edgeDetectionMaterial: THREE.NodeMaterial;
  #blurMaterial1: THREE.NodeMaterial;
  #blurMaterial2: THREE.NodeMaterial;
  #compositeMaterial: THREE.NodeMaterial;

  #priorityCopyMaterial: THREE.NodeMaterial;
  #priorityEdgeDetectionMaterial: THREE.NodeMaterial;

  #isolatedCopyMaterial: THREE.NodeMaterial;
  #isolatedEdgeDetectionMaterial: THREE.NodeMaterial;

  #quad: THREE.QuadMesh;

  constructor(
    renderer: THREE.WebGPURenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    options: HighlightPassOptions = {}
  ) {
    const { edgeThickness = 1, edgeGlow = 0, downSampleRatio = 2 } = options;

    this.#renderer = renderer;
    this.#scene = scene;
    this.#camera = camera;
    this.#downSampleRatio = downSampleRatio;
    this.#edgeThickness = edgeThickness;
    this.#edgeGlow = edgeGlow;

    this.#edgeThicknessUniform = uniform(edgeThickness);
    this.#edgeGlowUniform = uniform(edgeGlow);
    this.#blurDirectionUniform = uniform(this.#blurDirection);
    this.#invSizeUniform = uniform(this.#invSize);
    this.#maskColorUniform = uniform(this.#maskColor);

    const edgeThicknessNode = this.#edgeThicknessUniform;
    const edgeGlowNode = this.#edgeGlowUniform;
    const blurDirectionNode = this.#blurDirectionUniform;
    const invSizeNode = this.#invSizeUniform;
    // Genuine reinterpretation, not an inference workaround: this uniform
    // is built from a `THREE.Color` (so TSL infers a `"color"` node), but
    // every consumer below treats it as a plain `"vec3"` - same numeric
    // layout, different TSL type tag, so this cast is the only way to say
    // that. See `TslNode` for why the general node type isn't reachable
    // from `three/tsl`'s own public types.
    const maskColorNode = this.#maskColorUniform as TslNode<"vec3">;

    this.#renderTargetMask = new THREE.RenderTarget(1, 1);
    this.#renderTargetMaskDownSample = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetEdge1 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetEdge2 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetBlur1 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetBlur2 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetComposite = new THREE.RenderTarget(1, 1, { depthBuffer: false });

    // No depth buffer, unlike `#renderTargetMask` - the priority-only mask
    // is only ever drawn with `depthTest: false` (see its own doc comment),
    // so it never needs one.
    this.#renderTargetPriorityMask = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetPriorityMaskDownSample = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetPriorityEdge1 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetPriorityEdge2 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetPriorityBlur1 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetPriorityBlur2 = new THREE.RenderTarget(1, 1, { depthBuffer: false });

    // Same shape, for `isolated` entries - see `#renderTargetIsolatedMask`'s
    // own doc comment.
    this.#renderTargetIsolatedMask = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetIsolatedMaskDownSample = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetIsolatedEdge1 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetIsolatedEdge2 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetIsolatedBlur1 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetIsolatedBlur2 = new THREE.RenderTarget(1, 1, { depthBuffer: false });

    this.#maskTexture = texture(this.#renderTargetMask.texture);
    this.#maskDownSampleTexture = texture(this.#renderTargetMaskDownSample.texture);
    this.#blurSourceTexture = texture(this.#renderTargetEdge1.texture);
    this.#edge1Texture = texture(this.#renderTargetEdge1.texture);
    this.#edge2Texture = texture(this.#renderTargetEdge2.texture);
    this.#compositeTexture = texture(this.#renderTargetComposite.texture);

    this.#priorityMaskTexture = texture(this.#renderTargetPriorityMask.texture);
    this.#priorityMaskDownSampleTexture = texture(this.#renderTargetPriorityMaskDownSample.texture);
    this.#priorityEdge1Texture = texture(this.#renderTargetPriorityEdge1.texture);
    this.#priorityEdge2Texture = texture(this.#renderTargetPriorityEdge2.texture);

    this.#isolatedMaskTexture = texture(this.#renderTargetIsolatedMask.texture);
    this.#isolatedMaskDownSampleTexture = texture(this.#renderTargetIsolatedMaskDownSample.texture);
    this.#isolatedEdge1Texture = texture(this.#renderTargetIsolatedEdge1.texture);
    this.#isolatedEdge2Texture = texture(this.#renderTargetIsolatedEdge2.texture);

    // Only ever used for its color output here (`pipeline.outputNode` below)
    // - see this class's own doc comment for why no scene depth is read
    // anywhere in this class.
    const scenePassNode = pass(scene, camera);

    this.#maskMaterial = new THREE.NodeMaterial();
    this.#maskMaterial.name = "HighlightPass.mask";
    this.#maskMaterial.colorNode = vec4(maskColorNode, 1);

    // Separate material for the priority second pass (see `#renderMask`) -
    // `depthTest: false` so a priority entry always wins the shared mask
    // regardless of its actual distance from the camera. Reusing
    // `#maskMaterial` (depth-tested) would only let it win where it's
    // already the nearer of the two in real 3D space - "priority" means
    // always-on-top, not "on top when it happens to be nearer". Reused
    // as-is for `#renderTargetIsolatedMask`'s single pass too - stateless
    // beyond `maskColorNode`/`depthTest`, so one material covers both.
    this.#priorityMaskMaterial = new THREE.NodeMaterial();
    this.#priorityMaskMaterial.name = "HighlightPass.priorityMask";
    this.#priorityMaskMaterial.colorNode = vec4(maskColorNode, 1);
    this.#priorityMaskMaterial.depthTest = false;

    this.#copyMaterial = new THREE.NodeMaterial();
    this.#copyMaterial.name = "HighlightPass.copy";
    this.#copyMaterial.fragmentNode = this.#maskTexture;

    this.#priorityCopyMaterial = new THREE.NodeMaterial();
    this.#priorityCopyMaterial.name = "HighlightPass.priorityCopy";
    this.#priorityCopyMaterial.fragmentNode = this.#priorityMaskTexture;

    this.#isolatedCopyMaterial = new THREE.NodeMaterial();
    this.#isolatedCopyMaterial.name = "HighlightPass.isolatedCopy";
    this.#isolatedCopyMaterial.fragmentNode = this.#isolatedMaskTexture;

    // Edge detection: 4-neighbor boundary strength plus the weighted
    // average color of whichever neighbors are masked, instead of choosing
    // between two fixed uniform colors (OutlineNode's own approach). At a
    // boundary between two colors (two peers' outlines meeting), this
    // blends them rather than picking one - a known, accepted v1
    // approximation. See `tsl/edgeDetection.ts` for the full rationale.
    this.#edgeDetectionMaterial = new THREE.NodeMaterial();
    this.#edgeDetectionMaterial.name = "HighlightPass.edgeDetection";
    this.#edgeDetectionMaterial.fragmentNode = buildEdgeDetection(this.#maskDownSampleTexture, invSizeNode);

    this.#priorityEdgeDetectionMaterial = new THREE.NodeMaterial();
    this.#priorityEdgeDetectionMaterial.name = "HighlightPass.priorityEdgeDetection";
    this.#priorityEdgeDetectionMaterial.fragmentNode = buildEdgeDetection(
      this.#priorityMaskDownSampleTexture, invSizeNode
    );

    this.#isolatedEdgeDetectionMaterial = new THREE.NodeMaterial();
    this.#isolatedEdgeDetectionMaterial.name = "HighlightPass.isolatedEdgeDetection";
    this.#isolatedEdgeDetectionMaterial.fragmentNode = buildEdgeDetection(
      this.#isolatedMaskDownSampleTexture, invSizeNode
    );

    this.#blurMaterial1 = new THREE.NodeMaterial();
    this.#blurMaterial1.name = "HighlightPass.blur1";
    this.#blurMaterial1.fragmentNode = buildSeparableBlur(
      this.#blurSourceTexture, blurDirectionNode, invSizeNode, edgeThicknessNode
    );

    this.#blurMaterial2 = new THREE.NodeMaterial();
    this.#blurMaterial2.name = "HighlightPass.blur2";
    this.#blurMaterial2.fragmentNode = buildSeparableBlur(
      this.#blurSourceTexture, blurDirectionNode, invSizeNode, float(MAX_BLUR_RADIUS)
    );

    // Composite: combines the three edge-detect chains (shared,
    // priority-only, isolated-only) into the final ring output - see
    // `tsl/composite.ts` for why `max()` rather than `add()` combines them.
    this.#compositeMaterial = new THREE.NodeMaterial();
    this.#compositeMaterial.name = "HighlightPass.composite";
    this.#compositeMaterial.fragmentNode = buildHighlightComposite(
      { edge1: this.#edge1Texture, edge2: this.#edge2Texture, mask: this.#maskTexture },
      { edge1: this.#priorityEdge1Texture, edge2: this.#priorityEdge2Texture, mask: this.#priorityMaskTexture },
      { edge1: this.#isolatedEdge1Texture, edge2: this.#isolatedEdge2Texture, mask: this.#isolatedMaskTexture },
      edgeGlowNode
    );

    this.#quad = new THREE.QuadMesh();

    this.pipeline = new THREE.RenderPipeline(renderer);
    this.pipeline.outputNode = this.#compositeTexture.add(scenePassNode);
  }

  get edgeThickness(): number {
    return this.#edgeThickness;
  }

  setEdgeThickness(
    edgeThickness: number
  ): void {
    this.#edgeThickness = edgeThickness;
    this.#edgeThicknessUniform.value = edgeThickness;
  }

  get edgeGlow(): number {
    return this.#edgeGlow;
  }

  setEdgeGlow(
    edgeGlow: number
  ): void {
    this.#edgeGlow = edgeGlow;
    this.#edgeGlowUniform.value = edgeGlow;
  }

  /**
   * Replaces every currently outlined entry - traverses each whole-object
   * `target` into a flat mesh-to-color map (plus a set of `priority`
   * meshes), cached until the next call. An `isolated` entry lands in
   * `#isolatedEntryByMesh` instead, never joining the shared mask. An
   * entry with `instanceId` skips traversal entirely and is recorded into
   * `#instancedMask`, which bakes it into the mesh's GPU-side attributes
   * on `sync()` - `isolated` is silently ignored there (unsupported).
   */
  setEntries(
    entries: HighlightEntry[]
  ): void {
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
   * Renders the mask/edge-detection passes for the current entries, then the
   * scene through the outline pipeline. Call this instead of
   * `renderer.render(scene, camera)` in the render loop.
   */
  render(): void {
    this.#renderMask();
    this.pipeline.render();
  }

  /**
   * Frees the GPU resources owned by this pass (render targets, materials,
   * pipeline). Does not touch entries' own geometries/materials.
   */
  dispose(): void {
    this.#entryByMesh.clear();
    this.#priorityMeshes.clear();
    this.#isolatedEntryByMesh.clear();
    this.#instancedMask.dispose();

    this.#renderTargetMask.dispose();
    this.#renderTargetMaskDownSample.dispose();
    this.#renderTargetEdge1.dispose();
    this.#renderTargetEdge2.dispose();
    this.#renderTargetBlur1.dispose();
    this.#renderTargetBlur2.dispose();
    this.#renderTargetComposite.dispose();
    this.#renderTargetPriorityMask.dispose();
    this.#renderTargetPriorityMaskDownSample.dispose();
    this.#renderTargetPriorityEdge1.dispose();
    this.#renderTargetPriorityEdge2.dispose();
    this.#renderTargetPriorityBlur1.dispose();
    this.#renderTargetPriorityBlur2.dispose();
    this.#renderTargetIsolatedMask.dispose();
    this.#renderTargetIsolatedMaskDownSample.dispose();
    this.#renderTargetIsolatedEdge1.dispose();
    this.#renderTargetIsolatedEdge2.dispose();
    this.#renderTargetIsolatedBlur1.dispose();
    this.#renderTargetIsolatedBlur2.dispose();

    this.#maskMaterial.dispose();
    this.#priorityMaskMaterial.dispose();
    this.#copyMaterial.dispose();
    this.#edgeDetectionMaterial.dispose();
    this.#blurMaterial1.dispose();
    this.#blurMaterial2.dispose();
    this.#compositeMaterial.dispose();
    this.#priorityCopyMaterial.dispose();
    this.#priorityEdgeDetectionMaterial.dispose();
    this.#isolatedCopyMaterial.dispose();
    this.#isolatedEdgeDetectionMaterial.dispose();

    this.pipeline.dispose();
  }

  /**
   * Draws the mask pass (one flat-colored draw per currently outlined,
   * visible mesh - three's own scene traversal already culls anything
   * outside the frustum before this override ever sees it), then the
   * fixed downsample/edge-detect/blur/composite chain. Runs before
   * `this.pipeline.render()`, which only reads the resulting composite
   * texture.
   */
  #renderMask(): void {
    const renderer = this.#renderer;
    const scene = this.#scene;
    const camera = this.#camera;

    if (this.#entryByMesh.size === 0 && this.#instancedMask.size === 0 && this.#isolatedEntryByMesh.size === 0) {
      if (this.#lastEntryCount > 0) {
        this.#clearComposite();
        this.#lastEntryCount = 0;
      }

      return;
    }
    this.#lastEntryCount = this.#entryByMesh.size + this.#instancedMask.size + this.#isolatedEntryByMesh.size;

    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    const previousRenderObjectFunction = renderer.getRenderObjectFunction();
    const previousClearColor = new THREE.Color();
    renderer.getClearColor(previousClearColor);
    const previousClearAlpha = renderer.getClearAlpha();
    const previousBackground = scene.background;

    // A scene with an opaque `Color` background forces a full clear on
    // every `renderer.render()` call regardless of `autoClear` (three's
    // own `Background.update()` sets `forceClear = true` for one). The
    // priority second pass below relies on `autoClear = false` to layer
    // onto the first pass instead of wiping it - with the background
    // still attached, that call would silently re-clear the mask target
    // first, erasing what the first pass just drew. Nulled here, restored
    // below.
    scene.background = null;

    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.#setSize(size.width, size.height);

    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);

    // `renderObjectFunction`'s 8-parameter shape is dictated by
    // `Renderer.setRenderObjectFunction`'s own callback contract (same
    // shape `OutlineNode.js` itself overrides) - `_material` (the object's
    // own, un-overridden material) is unused since every masked object
    // always draws with `#maskMaterial` instead.
    renderer.setRenderObjectFunction((
      object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
      // eslint-disable-next-line max-params -- external callback contract, see comment above
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

    // Second pass: redraws every `priority` whole-object entry, and every
    // `InstancedMesh` referenced by any instanced entry, without clearing
    // the target first, so priority entries win the shared mask wherever
    // silhouettes overlap on screen. An `InstancedMesh` is always redrawn
    // here regardless of whether any instance is actually `priority` -
    // `priorityMaterial` discards non-priority instance fragments itself,
    // so a mesh with no priority instances just costs one harmless
    // all-discarded draw call.
    const hasPriority = this.#priorityMeshes.size > 0 || this.#instancedMask.size > 0;

    if (hasPriority) {
      renderer.autoClear = false;
      renderer.setRenderObjectFunction((
        object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
        // eslint-disable-next-line max-params -- external callback contract, see comment above
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

      // Third pass: the same override function (still active) redraws the
      // same priority entries into their own fresh target instead of
      // layering onto the shared mask - see `#renderTargetPriorityMask`
      // for why this second, independent chain exists.
      renderer.autoClear = true;
      renderer.setRenderTarget(this.#renderTargetPriorityMask);
      renderer.render(scene, camera);
    }
    else {
      // No priority entries this frame - clear only the two textures the
      // composite step actually samples (`#priorityEdge1Texture`/
      // `#priorityEdge2Texture`), skipping the mask render and the
      // downsample/edge-detect/blur chain below entirely, so a frame with no
      // priority entries pays nothing extra for it.
      renderer.setRenderTarget(this.#renderTargetPriorityEdge1);
      renderer.clear();
      renderer.setRenderTarget(this.#renderTargetPriorityEdge2);
      renderer.clear();
    }

    // Isolated entries: a single fresh `depthTest: false` pass, entirely
    // independent of the shared/priority mask above - reuses
    // `#priorityMaskMaterial` since the shape is identical, only the
    // target and feeding entries differ. Isolated entries were never in
    // `#entryByMesh` (see `setEntries`), so there's nothing there to win.
    const hasIsolated = this.#isolatedEntryByMesh.size > 0;

    if (hasIsolated) {
      renderer.autoClear = true;
      renderer.setRenderObjectFunction((
        object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
        // eslint-disable-next-line max-params -- external callback contract, see comment above
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
    else {
      renderer.setRenderTarget(this.#renderTargetIsolatedEdge1);
      renderer.clear();
      renderer.setRenderTarget(this.#renderTargetIsolatedEdge2);
      renderer.clear();
    }

    renderer.setRenderObjectFunction(previousRenderObjectFunction);

    // Restored here, not at the end - leaving these overridden any longer
    // risked the real scene render right after this method returns
    // picking them up too (the actual bug behind a real report of the
    // whole 3D view going white whenever any entry existed).
    renderer.autoClear = previousAutoClear;
    renderer.setClearColor(previousClearColor, previousClearAlpha);
    scene.background = previousBackground;

    this.#quad.material = this.#copyMaterial;
    renderer.setRenderTarget(this.#renderTargetMaskDownSample);
    this.#quad.render(renderer);

    this.#quad.material = this.#edgeDetectionMaterial;
    renderer.setRenderTarget(this.#renderTargetEdge1);
    this.#quad.render(renderer);

    this.#blurSourceTexture.value = this.#renderTargetEdge1.texture;
    this.#blurDirection.set(1, 0);
    this.#quad.material = this.#blurMaterial1;
    renderer.setRenderTarget(this.#renderTargetBlur1);
    this.#quad.render(renderer);

    this.#blurSourceTexture.value = this.#renderTargetBlur1.texture;
    this.#blurDirection.set(0, 1);
    renderer.setRenderTarget(this.#renderTargetEdge1);
    this.#quad.render(renderer);

    this.#blurSourceTexture.value = this.#renderTargetEdge1.texture;
    this.#blurDirection.set(1, 0);
    this.#quad.material = this.#blurMaterial2;
    renderer.setRenderTarget(this.#renderTargetBlur2);
    this.#quad.render(renderer);

    this.#blurSourceTexture.value = this.#renderTargetBlur2.texture;
    this.#blurDirection.set(0, 1);
    renderer.setRenderTarget(this.#renderTargetEdge2);
    this.#quad.render(renderer);

    if (hasPriority) {
      this.#quad.material = this.#priorityCopyMaterial;
      renderer.setRenderTarget(this.#renderTargetPriorityMaskDownSample);
      this.#quad.render(renderer);

      this.#quad.material = this.#priorityEdgeDetectionMaterial;
      renderer.setRenderTarget(this.#renderTargetPriorityEdge1);
      this.#quad.render(renderer);

      this.#blurSourceTexture.value = this.#renderTargetPriorityEdge1.texture;
      this.#blurDirection.set(1, 0);
      this.#quad.material = this.#blurMaterial1;
      renderer.setRenderTarget(this.#renderTargetPriorityBlur1);
      this.#quad.render(renderer);

      this.#blurSourceTexture.value = this.#renderTargetPriorityBlur1.texture;
      this.#blurDirection.set(0, 1);
      renderer.setRenderTarget(this.#renderTargetPriorityEdge1);
      this.#quad.render(renderer);

      this.#blurSourceTexture.value = this.#renderTargetPriorityEdge1.texture;
      this.#blurDirection.set(1, 0);
      this.#quad.material = this.#blurMaterial2;
      renderer.setRenderTarget(this.#renderTargetPriorityBlur2);
      this.#quad.render(renderer);

      this.#blurSourceTexture.value = this.#renderTargetPriorityBlur2.texture;
      this.#blurDirection.set(0, 1);
      renderer.setRenderTarget(this.#renderTargetPriorityEdge2);
      this.#quad.render(renderer);
    }

    if (hasIsolated) {
      this.#quad.material = this.#isolatedCopyMaterial;
      renderer.setRenderTarget(this.#renderTargetIsolatedMaskDownSample);
      this.#quad.render(renderer);

      this.#quad.material = this.#isolatedEdgeDetectionMaterial;
      renderer.setRenderTarget(this.#renderTargetIsolatedEdge1);
      this.#quad.render(renderer);

      this.#blurSourceTexture.value = this.#renderTargetIsolatedEdge1.texture;
      this.#blurDirection.set(1, 0);
      this.#quad.material = this.#blurMaterial1;
      renderer.setRenderTarget(this.#renderTargetIsolatedBlur1);
      this.#quad.render(renderer);

      this.#blurSourceTexture.value = this.#renderTargetIsolatedBlur1.texture;
      this.#blurDirection.set(0, 1);
      renderer.setRenderTarget(this.#renderTargetIsolatedEdge1);
      this.#quad.render(renderer);

      this.#blurSourceTexture.value = this.#renderTargetIsolatedEdge1.texture;
      this.#blurDirection.set(1, 0);
      this.#quad.material = this.#blurMaterial2;
      renderer.setRenderTarget(this.#renderTargetIsolatedBlur2);
      this.#quad.render(renderer);

      this.#blurSourceTexture.value = this.#renderTargetIsolatedBlur2.texture;
      this.#blurDirection.set(0, 1);
      renderer.setRenderTarget(this.#renderTargetIsolatedEdge2);
      this.#quad.render(renderer);
    }

    this.#quad.material = this.#compositeMaterial;
    renderer.setRenderTarget(this.#renderTargetComposite);
    this.#quad.render(renderer);

    renderer.setRenderTarget(previousTarget);
  }

  /**
   * Clears the composite target once, on the frame entries transitions to
   * empty - otherwise the last frame's outline would linger on screen since
   * nothing would draw over it. Same idea as `OutlineNode`'s own
   * `_lastSelectionCount` guard.
   */
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
    this.#renderTargetMask.setSize(width, height);
    this.#renderTargetComposite.setSize(width, height);
    this.#renderTargetPriorityMask.setSize(width, height);
    this.#renderTargetIsolatedMask.setSize(width, height);

    let resx = Math.round(width / this.#downSampleRatio);
    let resy = Math.round(height / this.#downSampleRatio);
    this.#renderTargetMaskDownSample.setSize(resx, resy);
    this.#renderTargetEdge1.setSize(resx, resy);
    this.#renderTargetBlur1.setSize(resx, resy);
    this.#renderTargetPriorityMaskDownSample.setSize(resx, resy);
    this.#renderTargetPriorityEdge1.setSize(resx, resy);
    this.#renderTargetPriorityBlur1.setSize(resx, resy);
    this.#renderTargetIsolatedMaskDownSample.setSize(resx, resy);
    this.#renderTargetIsolatedEdge1.setSize(resx, resy);
    this.#renderTargetIsolatedBlur1.setSize(resx, resy);
    this.#invSize.set(1 / resx, 1 / resy);

    resx = Math.round(resx / 2);
    resy = Math.round(resy / 2);
    this.#renderTargetEdge2.setSize(resx, resy);
    this.#renderTargetBlur2.setSize(resx, resy);
    this.#renderTargetPriorityEdge2.setSize(resx, resy);
    this.#renderTargetPriorityBlur2.setSize(resx, resy);
    this.#renderTargetIsolatedEdge2.setSize(resx, resy);
    this.#renderTargetIsolatedBlur2.setSize(resx, resy);
  }
}
