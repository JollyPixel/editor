// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  Fn,
  Loop,
  int,
  float,
  vec2,
  vec3,
  vec4,
  uv,
  uniform,
  texture,
  max,
  saturate,
  exp,
  oneMinus,
  pass,
  instancedBufferAttribute,
  If,
  Discard
} from "three/tsl";

// Import Internal Dependencies
import type { SelectableObject } from "../SelectionManager.ts";

// CONSTANTS
// Matches OutlineNode's own separable-blur kernel radius.
const kMaxBlurRadius = 4;

/**
 * Plain TS helper (not a TSL `Fn`) - `Fn`'s inferred type only covers its
 * zero-arg/`NodeBuilder`-callback overloads, not the multi-parameter TSL
 * function form three's own `OutlineNode.js` uses (untyped JS there, so it
 * never hits this). A regular function inlines the same math into whichever
 * shader calls it. `x`/`sigma`/the return value are deliberately left
 * untyped (`noImplicitAny` is off for exactly this kind of friction) -
 * `.toVar()`/`.div()` chains produce TSL node types too specifically
 * branded (`VarNode<T, ConvertNode<T>>` vs `Node<T>` vs
 * `VarNode<T, ConstNode<T>>`) for a hand-written `ReturnType<typeof float>`
 * annotation to accept every call shape below without a cast.
 */
function gaussianPdf(x, sigma) {
  return float(0.39894).mul(exp(float(-0.5).mul(x).mul(x).div(sigma.mul(sigma))).div(sigma));
}

/**
 * "Is masked" signal for a sampled mask-buffer texel, used by edge detection
 * and the composite step in place of the texture's own alpha channel - see
 * the comment above the edge-detection material's own construction for why.
 */
function maskWeight(c) {
  return saturate(c.rgb.length());
}

/**
 * Separable Gaussian blur, same shape as `OutlineNode.separableBlur` - built
 * once per resolution level (half-res "thickness" pass, quarter-res "glow"
 * pass) via `kernelRadius`, run X then Y via `blurDirectionNode`, toggled
 * between calls by the caller. `kernelRadius` is left untyped for the same
 * reason as `gaussianPdf`'s own params.
 */
function buildSeparableBlur(
  blurSourceTexture: ReturnType<typeof texture>,
  blurDirectionNode: ReturnType<typeof vec2>,
  invSizeNode: ReturnType<typeof vec2>,
  kernelRadius
) {
  return Fn(() => {
    const uvNode = uv();
    const sigma = kernelRadius.div(2).toVar();
    const weightSum = gaussianPdf(float(0), sigma).toVar();
    const diffuseSum = blurSourceTexture.sample(uvNode).mul(weightSum).toVar();
    const delta = blurDirectionNode.mul(invSizeNode).mul(kernelRadius).div(kMaxBlurRadius).toVar();
    const uvOffset = delta.toVar();

    Loop({ start: int(1), end: int(kMaxBlurRadius), type: "int", condition: "<=" }, ({ i }) => {
      const x = kernelRadius.mul(float(i)).div(kMaxBlurRadius);
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

/**
 * 4-neighbor edge detection over a downsampled mask, extracted so both the
 * shared mask (`#edgeDetectionMaterial`) and the priority-only mask
 * (`#priorityEdgeDetectionMaterial`) can reuse the exact same shader instead
 * of duplicating it - see `#renderTargetPriorityMask`'s own doc comment for
 * why a second, independent mask/edge-detect chain exists at all. Boundary
 * strength, weighted-average edge color, and the RGB-distance-not-length
 * reasoning are all unchanged from the original single-chain version - see
 * the inline comments where this is called for that rationale.
 */
function buildEdgeDetection(
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

export interface ColoredOutlineEntry {
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
   * When two entries' silhouettes overlap on screen, the first mask pass
   * resolves it with a normal depth test - whichever entry is actually
   * nearer the camera wins there, same as any other draw. That's often not
   * what the caller wants: without this, an entry that matters more (e.g.
   * the local user's own selection) can still be hidden behind one that
   * happens to sit in front of it in the scene. Setting this true draws the
   * entry again in a second, `depthTest: false` pass after every
   * non-priority entry, so it always wins the overlap regardless of
   * traversal order or actual depth. Typical use: the local user's own
   * selection, so it stays visibly outlined even where a peer's selection
   * is actually in front of it on screen.
   *
   * That "wins the shared mask" guarantee alone isn't quite enough for a
   * priority entry whose silhouette ends up entirely enclosed within a
   * larger, nearer non-priority entry's own silhouette (e.g. a small local
   * selection viewed from far away, with a much closer peer selection
   * projecting large enough on screen to fully swallow it) - the composite
   * step only ever draws a ring into background-adjacent pixels, so a
   * boundary that never touches actual background has nowhere to paint a
   * ring into even after priority already won the color underneath. A
   * priority entry also gets its own independent, self-only mask/edge-detect
   * chain (see `#renderTargetPriorityMask`'s own doc comment) specifically
   * to cover this case - its ring is guaranteed visible regardless of what
   * (or how much of) a non-priority entry surrounds it.
   * @default false
   */
  priority?: boolean;
  /**
   * The opposite concern from `priority`: this entry's ring is always drawn
   * complete, from its own dedicated mask, entirely independent of every
   * other entry - it never competes for the shared mask, so it can neither
   * be cut by another entry (the same "wins the overlap" problem `priority`
   * solves) nor accidentally *cut one itself* by winning an ordinary depth
   * test it happened to be nearer for (the problem `priority` does *not*
   * solve, since a `priority` entry still redraws into the shared mask and
   * can still out-depth a non-priority one there). Typical use: a transient
   * hover preview, which should always read clearly but has no business
   * clipping a peer's selection ring just because it's nearer the camera
   * right now. Mutually exclusive with `priority` in practice - an isolated
   * entry never touches the shared mask at all, so there is nothing there
   * for it to win. Pays for its own mask/edge-detect chain (see
   * `#renderTargetIsolatedMask`'s own doc comment), same cost shape as
   * `priority` - skipped entirely on a frame with none. Not supported
   * alongside `instanceId` (ignored there).
   * @default false
   */
  isolated?: boolean;
  /**
   * Selects a single instance of an `THREE.InstancedMesh` `target`, instead
   * of outlining `target` as a whole - required when `target` is a
   * `THREE.InstancedMesh` (which has no meaningful "whole object" mask,
   * since it draws many distinct instances in one object), and must be
   * omitted for any other `target`. See this class's own doc comment for how
   * many simultaneously-outlined instances of the same `InstancedMesh` still
   * cost only the two draw calls the whole mesh already costs, not one per
   * instance.
   */
  instanceId?: number;
}

export interface ColoredOutlinePassOptions {
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
 * Scene-level postprocess outline that renders many simultaneously outlined
 * objects, each in its own arbitrary color, in a single shared mask +
 * edge-detection pass - the same general shape as three's own stock
 * `OutlineNode` (mask, edge-detect, blur, composite), generalized from
 * `OutlineNode`'s fixed "selected"/"hovered" roles to an arbitrary
 * per-entry color, and without repeating `OutlineNode`'s own expensive
 * non-selected-scene depth pre-pass - this class has no notion of scene
 * depth at all (see the note below).
 *
 * This class never re-renders the rest of the scene: its mask pass draws
 * only the objects currently in `setEntries`, via the same
 * `renderer.setRenderObjectFunction` override technique `OutlineNode` itself
 * uses, just swapping in each object's own color instead of a fixed one.
 * Cost scales with how many outlined objects are actually visible this
 * frame, not with total scene size, peer count, or how many distinct colors
 * are in use - see `docs/ColoredOutlinePass.md` for the full rationale.
 *
 * Deliberately has no notion of peers, `SelectionManager`, or
 * `PeerSelectionRegistry` - it only ever paints colored outlines around
 * whatever `{ target, color }` entries it's given, the same
 * agnostic-core-vs-thin-glue split `PeerSelectionRegistry` already uses (see
 * its own doc comment). `PeerColoredOutlinePass` is the thin adapter that
 * feeds it from the selection system - including the local user's own
 * selection, so it's a complete, self-sufficient driver with zero peers too,
 * not something that only makes sense once peers exist.
 *
 * @note
 * Requires `THREE.WebGPURenderer`. Owns its own `RenderPipeline` (`render()`
 * replaces `renderer.render(scene, camera)`) - `RenderPipeline.outputNode`
 * is a single composed graph per instance, so this can't currently be
 * composited into the same frame as another whole-frame postprocess
 * pipeline; pick one per scene.
 *
 * @note
 * Not occlusion-aware, deliberately: an entry's ring always draws at full,
 * uniform strength around its own silhouette, regardless of what real scene
 * geometry sits in front of it - effectively permanent x-ray, the same
 * always-visible behavior for every entry, local selection and peers alike.
 * Two earlier designs were built and reverted before landing here: one
 * compared each masked pixel's own depth against the real scene's depth at
 * that same pixel (accurate, angle-independent, but left a rare spurious
 * edge exactly along the occlusion cut line wherever an entry was partially
 * occluded); an even earlier one propagated that compare outward toward the
 * ring's own pixel via a bounded search, which got measurably less accurate
 * at grazing viewing angles. Both were replaced by dropping occlusion
 * awareness entirely - the "hidden, dimmed" ring segment those designs
 * produced when `xray` was on visually read as two different intensities
 * stitched together at a seam, which was worse for legibility than simply
 * never dimming at all. No scene depth is read anywhere in this class as a
 * result - `pass(scene, camera)` is used only for its color output.
 *
 * @note
 * A `priority: true` entry (`ColoredOutlineEntry.priority`) is guaranteed
 * visible even when its own silhouette is entirely enclosed inside a larger,
 * nearer non-priority entry's silhouette - not just "wins the shared mask
 * pixels" (which the original single-mask design already gave it) but "its
 * ring actually gets drawn somewhere," via a second, independent, self-only
 * mask/edge-detect chain (see `#renderTargetPriorityMask`'s own doc
 * comment). Only entries marked `priority` pay for this second chain -
 * skipped entirely on a frame with none.
 *
 * @note
 * An `isolated: true` entry (`ColoredOutlineEntry.isolated`) is the opposite
 * of `priority`: it never touches the shared mask at all, drawing its ring
 * from a third, independent, self-only mask/edge-detect chain (see
 * `#renderTargetIsolatedMask`'s own doc comment) - so it can neither be cut
 * by another entry nor cut one itself by winning an ordinary depth-test
 * overlap it happened to be nearer for. Only entries marked `isolated` pay
 * for this chain - skipped entirely on a frame with none.
 *
 * @note
 * Entries with `instanceId` set (see `ColoredOutlineEntry.instanceId`)
 * outline individual instances of a `THREE.InstancedMesh` - see
 * `#getInstancedResources`'s own doc comment for how that stays within the
 * same two-draw-calls-per-mesh cost regardless of how many of that mesh's
 * instances are simultaneously outlined, unlike one `SelectionOutline` per
 * instance.
 */
interface InstancedMaskResources {
  /** Per-instance mask color, read by `material` for every instance whose `maskedFlagAttribute` is set. */
  colorAttribute: THREE.InstancedBufferAttribute;
  /**
   * Per-instance "is this an outlined entry" flag (`1`/`0`), read by
   * `material` to discard every non-outlined instance's fragments entirely -
   * not just zero their color. Instancing draws every instance of the mesh
   * in one call regardless of which ones are entries, so without this
   * discard a non-outlined instance would still write into the mask
   * target's depth buffer at its own real depth, letting it win the shared
   * mask's own depth test against an actually-outlined instance (or an
   * unrelated whole-object entry) behind it - a non-entry silently blocking
   * an entry from the mask target entirely, which a whole-object entry never
   * risks (a non-entry mesh is simply never drawn into the mask target at
   * all). `Discard()`-ing the fragment (not just writing `(0,0,0)`)
   * is what keeps a non-outlined instance from touching the mask target in
   * any way, matching that same "never drawn there" behavior.
   */
  maskedFlagAttribute: THREE.InstancedBufferAttribute;
  /**
   * Per-instance priority flag (`1` = priority, `0` = not), read by
   * `priorityMaterial` to discard every non-priority instance's fragments -
   * without that discard, a `depthTest: false` redraw of the *whole*
   * `InstancedMesh` (unavoidable - instancing draws every instance in one
   * call regardless of which material renders it) would overwrite every
   * pixel the mesh touches with whatever this pass's color/discard state
   * says, including already-correct non-priority pixels `material` drew in
   * the first pass. Reusing `colorAttribute` for color and gating with this
   * separate flag - rather than a second color attribute zeroed for
   * non-priority instances - is what makes that discard exact rather than
   * relying on "zero color happens to look like background", which would
   * still wrongly overwrite (with black) any non-priority instance pixel it
   * touches.
   */
  priorityFlagAttribute: THREE.InstancedBufferAttribute;
  /** Depth-tested normal-pass material - reads `colorAttribute` for every masked instance, discards the rest. */
  material: THREE.NodeMaterial;
  /** `depthTest: false` priority-pass material - discards where `priorityFlagAttribute` is `0`. */
  priorityMaterial: THREE.NodeMaterial;
}

export class ColoredOutlinePass {
  readonly pipeline: THREE.RenderPipeline;

  #renderer: THREE.WebGPURenderer;
  #scene: THREE.Scene;
  #camera: THREE.Camera;
  #downSampleRatio: number;

  #entryByMesh = new Map<THREE.Mesh, THREE.Color>();
  #priorityMeshes = new Set<THREE.Mesh>();
  /**
   * `isolated` entries land here instead of `#entryByMesh` entirely - never
   * part of the shared mask's own pool, see `ColoredOutlineEntry.isolated`'s
   * own doc comment for why.
   */
  #isolatedEntryByMesh = new Map<THREE.Mesh, THREE.Color>();
  /**
   * Per `THREE.InstancedMesh`, per-instance color - entries with an
   * `instanceId` land here instead of `#entryByMesh`, since an InstancedMesh
   * is one object drawn in one call, not many objects to look up by identity.
   * `priority` is folded into the same value (rather than a parallel
   * `Set`-of-meshes like `#priorityMeshes`) because it's now a per-*instance*
   * flag, not a per-mesh one - a single `InstancedMesh` can have both
   * priority and non-priority instances outlined at once.
   */
  #instancedEntries = new Map<THREE.InstancedMesh, Map<number, { color: THREE.Color; priority: boolean; }>>();
  /**
   * Lazily-built, per-`InstancedMesh` GPU resources for `#instancedEntries` -
   * see `#getInstancedResources`'s own doc comment for what each one is and
   * why two separate materials/attributes are needed. A plain `Map` (not a
   * `WeakMap`) despite being keyed by scene objects, unlike similar caches
   * elsewhere - `dispose()` needs to iterate every entry to free its
   * materials, which a `WeakMap` can't be iterated to do.
   */
  #instancedResources = new Map<THREE.InstancedMesh, InstancedMaskResources>();
  #lastEntryCount = 0;

  #edgeThickness: number;
  #edgeGlow: number;
  #edgeThicknessUniform: ReturnType<typeof uniform>;
  #edgeGlowUniform: ReturnType<typeof uniform>;

  /**
   * Plain `THREE.Vector2`/`THREE.Color` instances kept alongside (rather
   * than read back from) the matching uniform above - the exact object
   * `uniform()` stores as that uniform's `.value` (by reference, not a
   * copy), so mutating these in place also updates what the GPU reads,
   * without needing to read back through the uniform's own untyped `.value`.
   */
  #blurDirection = new THREE.Vector2();
  #invSize = new THREE.Vector2();
  #maskColor = new THREE.Color();
  #blurDirectionUniform: ReturnType<typeof uniform>;
  #invSizeUniform: ReturnType<typeof uniform>;
  #maskColorUniform: ReturnType<typeof uniform>;

  #renderTargetMask: THREE.RenderTarget;
  #renderTargetMaskDownSample: THREE.RenderTarget;
  #renderTargetEdge1: THREE.RenderTarget;
  #renderTargetEdge2: THREE.RenderTarget;
  #renderTargetBlur1: THREE.RenderTarget;
  #renderTargetBlur2: THREE.RenderTarget;
  #renderTargetComposite: THREE.RenderTarget;

  /**
   * Second, independent mask - only ever populated by `priority` entries,
   * always `depthTest: false` (so, like the shared mask's own priority
   * redraw, it ignores both real scene depth and every non-priority entry
   * entirely) - and always cleared fresh, never layered onto the shared
   * mask. Its own downsample/edge-detect/blur chain
   * (`#renderTargetPriorityMaskDownSample`/`#renderTargetPriorityEdge1`/
   * `#renderTargetPriorityEdge2`/`#renderTargetPriorityBlur1`/
   * `#renderTargetPriorityBlur2`) mirrors the shared one exactly, reusing
   * the same blur materials (`#blurMaterial1`/`#blurMaterial2`, parameterized
   * by `#blurSourceTexture`'s mutable `.value` already, so no separate blur
   * materials are needed) but its own dedicated copy/edge-detection
   * materials, since those hardcode which texture they read from.
   *
   * Exists because the shared mask's composite step only ever draws a ring
   * into pixels the shared mask itself doesn't already claim (`oneMinus(
   * maskWeight(...))`, see `#compositeMaterial`) - a priority entry's ring
   * has nowhere to paint once its whole silhouette sits inside a larger,
   * nearer non-priority entry's own silhouette, even though the shared
   * mask's own priority pass already gave it the right color underneath.
   * This second mask is excluded *only by its own silhouette*, so its ring
   * always has somewhere to go - see `ColoredOutlineEntry.priority`'s own
   * doc comment.
   */
  #renderTargetPriorityMask: THREE.RenderTarget;
  #renderTargetPriorityMaskDownSample: THREE.RenderTarget;
  #renderTargetPriorityEdge1: THREE.RenderTarget;
  #renderTargetPriorityEdge2: THREE.RenderTarget;
  #renderTargetPriorityBlur1: THREE.RenderTarget;
  #renderTargetPriorityBlur2: THREE.RenderTarget;

  /**
   * Third, independent mask - only ever populated by `isolated` entries,
   * same shape as `#renderTargetPriorityMask` (always `depthTest: false`,
   * always cleared fresh) but for the opposite reason: an `isolated` entry
   * never redraws into the shared mask at all (see
   * `ColoredOutlineEntry.isolated`'s own doc comment), so unlike `priority`
   * there is no "wins the shared mask" pass feeding into this one - the
   * shared mask's own first pass simply never sees isolated meshes (they're
   * never in `#entryByMesh`, see `setEntries`). Its own downsample/
   * edge-detect/blur chain mirrors the priority one exactly, reusing the
   * same blur materials for the same reason.
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
    options: ColoredOutlinePassOptions = {}
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

    // `uniform()`'s return type-checks as an untagged `UniformNode<unknown>`
    // (its JSDoc return type isn't parameterized by the value/type argument
    // given), which TSL's fluent `.mul()`/`.div()` overloads can't resolve
    // as an argument. These casts tell TypeScript the concrete node type each
    // uniform actually builds at runtime, same live reference, just
    // narrowed for the type checker.
    const edgeThicknessNode = this.#edgeThicknessUniform as unknown as ReturnType<typeof float>;
    const edgeGlowNode = this.#edgeGlowUniform as unknown as ReturnType<typeof float>;
    const blurDirectionNode = this.#blurDirectionUniform as unknown as ReturnType<typeof vec2>;
    const invSizeNode = this.#invSizeUniform as unknown as ReturnType<typeof vec2>;
    const maskColorNode = this.#maskColorUniform as unknown as ReturnType<typeof vec3>;

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
    this.#maskMaterial.name = "ColoredOutlinePass.mask";
    this.#maskMaterial.colorNode = vec4(maskColorNode, 1);

    // Separate material for the priority second pass (see `#renderMask`) -
    // `depthTest: false` so a priority entry always wins the shared mask
    // buffer at every pixel it covers, regardless of its actual distance
    // from the camera. Reusing `#maskMaterial` (depth-tested, like every
    // normal draw) would only let the priority redraw win where the local
    // selection is already the nearer of the two in real 3D space - if a
    // peer's selected object is actually in front of it on screen, the
    // depth buffer pass 1 already wrote would fail the priority mesh's own
    // fragments there, and the peer would still show through untouched.
    // "priority" means always-on-top, not "on top when it happens to be
    // nearer" - this is what actually guarantees that. Reused as-is for
    // `#renderTargetIsolatedMask`'s own single pass too (see `#renderMask`) -
    // stateless beyond `maskColorNode`/`depthTest`, so one material covers
    // both roles.
    this.#priorityMaskMaterial = new THREE.NodeMaterial();
    this.#priorityMaskMaterial.name = "ColoredOutlinePass.priorityMask";
    this.#priorityMaskMaterial.colorNode = vec4(maskColorNode, 1);
    this.#priorityMaskMaterial.depthTest = false;

    this.#copyMaterial = new THREE.NodeMaterial();
    this.#copyMaterial.name = "ColoredOutlinePass.copy";
    this.#copyMaterial.fragmentNode = this.#maskTexture;

    this.#priorityCopyMaterial = new THREE.NodeMaterial();
    this.#priorityCopyMaterial.name = "ColoredOutlinePass.priorityCopy";
    this.#priorityCopyMaterial.fragmentNode = this.#priorityMaskTexture;

    this.#isolatedCopyMaterial = new THREE.NodeMaterial();
    this.#isolatedCopyMaterial.name = "ColoredOutlinePass.isolatedCopy";
    this.#isolatedCopyMaterial.fragmentNode = this.#isolatedMaskTexture;

    // Edge detection: 4-neighbor boundary strength plus the weighted average
    // color of whichever neighbors are actually masked, instead of choosing
    // between two fixed uniform colors (OutlineNode's own approach). At a
    // boundary between two different colors (two peers' outlines meeting),
    // this blends them rather than picking one - a known, accepted v1
    // approximation.
    //
    // Uses RGB length (`maskWeight`) rather than the mask target's own alpha
    // channel as the "is masked" signal - `renderer.setClearColor(..., 0)`
    // does not reliably clear this render target's alpha to 0 on this
    // renderer (verified empirically: sampling alpha directly reads 1
    // everywhere, drawn pixels and background alike), so alpha isn't a
    // usable channel here. RGB itself clears to true black and is otherwise
    // unused by anything downstream, so its length doubles as a masked/not
    // signal - correct as long as no assigned entry color is at or near
    // pure black, since that would read as unmasked.
    //
    // `buildEdgeDetection` is shared with `#priorityEdgeDetectionMaterial`
    // below, parameterized only by which downsampled mask to read - see that
    // function's own doc comment.
    this.#edgeDetectionMaterial = new THREE.NodeMaterial();
    this.#edgeDetectionMaterial.name = "ColoredOutlinePass.edgeDetection";
    this.#edgeDetectionMaterial.fragmentNode = buildEdgeDetection(this.#maskDownSampleTexture, invSizeNode);

    this.#priorityEdgeDetectionMaterial = new THREE.NodeMaterial();
    this.#priorityEdgeDetectionMaterial.name = "ColoredOutlinePass.priorityEdgeDetection";
    this.#priorityEdgeDetectionMaterial.fragmentNode = buildEdgeDetection(
      this.#priorityMaskDownSampleTexture, invSizeNode
    );

    this.#isolatedEdgeDetectionMaterial = new THREE.NodeMaterial();
    this.#isolatedEdgeDetectionMaterial.name = "ColoredOutlinePass.isolatedEdgeDetection";
    this.#isolatedEdgeDetectionMaterial.fragmentNode = buildEdgeDetection(
      this.#isolatedMaskDownSampleTexture, invSizeNode
    );

    this.#blurMaterial1 = new THREE.NodeMaterial();
    this.#blurMaterial1.name = "ColoredOutlinePass.blur1";
    this.#blurMaterial1.fragmentNode = buildSeparableBlur(
      this.#blurSourceTexture, blurDirectionNode, invSizeNode, edgeThicknessNode
    );

    this.#blurMaterial2 = new THREE.NodeMaterial();
    this.#blurMaterial2.name = "ColoredOutlinePass.blur2";
    this.#blurMaterial2.fragmentNode = buildSeparableBlur(
      this.#blurSourceTexture, blurDirectionNode, invSizeNode, float(kMaxBlurRadius)
    );

    // Composite: sums the two blur levels (glow-weighted) and masks out the
    // outlined object's own surface - `#maskTexture` (full-resolution,
    // unblurred) reads ~1 via `maskWeight` exactly on an outlined object's
    // own rasterized pixels, so `oneMinus` of it keeps the outline in the
    // surrounding background only, the same role OutlineNode's own composite
    // gives its mask multiply. Always the entry's full silhouette, regardless
    // of real scene occlusion - see this class's own doc comment for why.
    //
    // `priorityRing` is the same shape, computed from the independent
    // priority-only chain instead (see `#renderTargetPriorityMask`'s own doc
    // comment) - excluded only by *its own* silhouette, so it still has
    // somewhere to paint even where `ring` has none (a priority entry's
    // silhouette fully enclosed inside a larger non-priority one). `max()`,
    // not `add()`: at a priority entry's own exposed boundary (the common
    // case), both channels independently detect essentially the same edge,
    // and simply summing them would double-brighten it there for no reason -
    // `max()` guarantees at least as visible as either channel alone without
    // that overshoot, and is a no-op wherever only one channel has anything
    // to contribute.
    this.#compositeMaterial = new THREE.NodeMaterial();
    this.#compositeMaterial.name = "ColoredOutlinePass.composite";
    this.#compositeMaterial.fragmentNode = Fn(() => {
      const edgeValue = this.#edge1Texture.add(this.#edge2Texture.mul(edgeGlowNode));
      const ring = edgeValue.mul(oneMinus(maskWeight(this.#maskTexture)));

      const priorityEdgeValue = this.#priorityEdge1Texture.add(this.#priorityEdge2Texture.mul(edgeGlowNode));
      const priorityRing = priorityEdgeValue.mul(oneMinus(maskWeight(this.#priorityMaskTexture)));

      const isolatedEdgeValue = this.#isolatedEdge1Texture.add(this.#isolatedEdge2Texture.mul(edgeGlowNode));
      const isolatedRing = isolatedEdgeValue.mul(oneMinus(maskWeight(this.#isolatedMaskTexture)));

      return max(max(ring, priorityRing), isolatedRing);
    })();

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
   * `target` (group support, same as three's own `OutlineNode`) into a flat
   * mesh-to-color map (plus a set of `priority` meshes, see that field's own
   * doc comment), cached until the next call rather than rebuilt every
   * frame. An `isolated` entry (see `ColoredOutlineEntry.isolated`) lands in
   * `#isolatedEntryByMesh` instead, never `#entryByMesh` - it doesn't
   * participate in the shared mask at all. An entry with `instanceId` set
   * skips traversal entirely (an `InstancedMesh` has no children to find)
   * and lands in `#instancedEntries` instead, which
   * `#syncInstancedAttributes` then bakes into each referenced mesh's
   * GPU-side attributes - `isolated` is silently ignored there (unsupported,
   * see `ColoredOutlineEntry.isolated`'s own doc comment).
   */
  setEntries(
    entries: ColoredOutlineEntry[]
  ): void {
    this.#entryByMesh.clear();
    this.#priorityMeshes.clear();
    this.#isolatedEntryByMesh.clear();
    this.#instancedEntries.clear();

    for (const { target, color, priority = false, isolated = false, instanceId } of entries) {
      const threeColor = color instanceof THREE.Color ? color.clone() : new THREE.Color(color);

      if (instanceId !== undefined) {
        const mesh = target as THREE.InstancedMesh;
        let idColor = this.#instancedEntries.get(mesh);
        if (!idColor) {
          idColor = new Map();
          this.#instancedEntries.set(mesh, idColor);
        }
        idColor.set(instanceId, { color: threeColor, priority });
        continue;
      }

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

    this.#syncInstancedAttributes();
  }

  /**
   * Bakes `#instancedEntries` into each referenced mesh's GPU-side
   * attributes - called once per `setEntries`, not per frame, same as the
   * whole-object maps it mirrors.
   */
  #syncInstancedAttributes(): void {
    for (const [mesh, idColor] of this.#instancedEntries) {
      const resources = this.#getInstancedResources(mesh);
      resources.colorAttribute.array.fill(0);
      resources.maskedFlagAttribute.array.fill(0);
      resources.priorityFlagAttribute.array.fill(0);

      for (const [instanceId, { color, priority }] of idColor) {
        color.toArray(resources.colorAttribute.array, instanceId * 3);
        resources.maskedFlagAttribute.array[instanceId] = 1;
        resources.priorityFlagAttribute.array[instanceId] = priority ? 1 : 0;
      }

      resources.colorAttribute.needsUpdate = true;
      resources.maskedFlagAttribute.needsUpdate = true;
      resources.priorityFlagAttribute.needsUpdate = true;
    }
  }

  /**
   * Lazily builds (and rebuilds if `mesh.count` has since changed) the GPU
   * resources one `InstancedMesh` needs to mask its own instances - one set
   * of attributes/materials per mesh, reused and just rewritten across
   * `setEntries` calls, so outlining a different subset of the same mesh's
   * instances never costs a new shader compile.
   *
   * Deliberately not `mesh.instanceColor`: three auto-multiplies *any*
   * material's diffuse color by `instanceColor` when it's set (see
   * `NodeMaterial.setupDiffuseColor`), which would also tint the mesh's own
   * normal scene rendering - every non-outlined instance would render pure
   * black, since this pass's convention is "0 = not outlined". A dedicated
   * `THREE.InstancedBufferAttribute`, read via an explicit
   * `instancedBufferAttribute()` TSL node only inside this pass's own
   * materials, keeps that convention from leaking into the object's normal
   * appearance - the same technique three's own `instance()` TSL helper uses
   * internally for `instanceColor` itself, just aimed at a buffer that isn't it.
   */
  #getInstancedResources(
    mesh: THREE.InstancedMesh
  ): InstancedMaskResources {
    const cached = this.#instancedResources.get(mesh);
    if (cached && cached.colorAttribute.count === mesh.count) {
      return cached;
    }
    cached?.material.dispose();
    cached?.priorityMaterial.dispose();

    const colorAttribute = new THREE.InstancedBufferAttribute(new Float32Array(mesh.count * 3), 3);
    const maskedFlagAttribute = new THREE.InstancedBufferAttribute(new Float32Array(mesh.count), 1);
    const priorityFlagAttribute = new THREE.InstancedBufferAttribute(new Float32Array(mesh.count), 1);

    // `instancedBufferAttribute()`'s return type-checks as an untagged
    // `Node<string>` (its declared return type isn't parameterized by the
    // "vec3"/"float" type-name argument given), which TSL's fluent
    // `.lessThan()`/typed-constructor overloads can't resolve as an argument
    // - same limitation this file's own `uniform()` calls already document
    // on their own casts. These tell TypeScript the concrete node type each
    // call actually builds at runtime, same live node, just narrowed for the
    // type checker.
    function instancedColorNode(): ReturnType<typeof vec3> {
      return instancedBufferAttribute(colorAttribute, "vec3") as unknown as ReturnType<typeof vec3>;
    }
    function instancedFlagNode(attribute: THREE.InstancedBufferAttribute): ReturnType<typeof float> {
      return instancedBufferAttribute(attribute, "float") as unknown as ReturnType<typeof float>;
    }

    const material = new THREE.NodeMaterial();
    material.name = "ColoredOutlinePass.instancedMask";
    material.colorNode = Fn(() => {
      If(instancedFlagNode(maskedFlagAttribute).lessThan(0.5), () => {
        Discard();
      });

      return vec4(instancedColorNode(), 1);
    })();

    const priorityMaterial = new THREE.NodeMaterial();
    priorityMaterial.name = "ColoredOutlinePass.instancedPriorityMask";
    priorityMaterial.depthTest = false;
    priorityMaterial.colorNode = Fn(() => {
      If(instancedFlagNode(priorityFlagAttribute).lessThan(0.5), () => {
        Discard();
      });

      return vec4(instancedColorNode(), 1);
    })();

    const resources: InstancedMaskResources = {
      colorAttribute, maskedFlagAttribute, priorityFlagAttribute, material, priorityMaterial
    };
    this.#instancedResources.set(mesh, resources);

    return resources;
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
    this.#instancedEntries.clear();
    for (const resources of this.#instancedResources.values()) {
      resources.material.dispose();
      resources.priorityMaterial.dispose();
    }
    this.#instancedResources.clear();

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
   * Draws the mask pass (one cheap flat-colored draw per currently outlined,
   * currently visible mesh - three's own scene traversal already skips
   * anything outside the camera frustum before this override function ever
   * sees it, the same free culling `OutlineNode`'s own mask pass relies on),
   * then the fixed downsample/edge-detect/blur/composite chain. Runs before
   * `this.pipeline.render()`, which only reads the resulting composite
   * texture.
   */
  #renderMask(): void {
    const renderer = this.#renderer;
    const scene = this.#scene;
    const camera = this.#camera;

    if (this.#entryByMesh.size === 0 && this.#instancedEntries.size === 0 && this.#isolatedEntryByMesh.size === 0) {
      if (this.#lastEntryCount > 0) {
        this.#clearComposite();
        this.#lastEntryCount = 0;
      }

      return;
    }
    this.#lastEntryCount = this.#entryByMesh.size + this.#instancedEntries.size + this.#isolatedEntryByMesh.size;

    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    const previousRenderObjectFunction = renderer.getRenderObjectFunction();
    const previousClearColor = new THREE.Color();
    renderer.getClearColor(previousClearColor);
    const previousClearAlpha = renderer.getClearAlpha();
    const previousBackground = scene.background;

    // A scene with an opaque `Color` background forces a full clear on every
    // `renderer.render()` call regardless of `renderer.autoClear` (see
    // three's own `Background.update()`: an opaque color background sets
    // `forceClear = true`, which then clears color+depth unconditionally).
    // The priority second pass below relies on `autoClear = false` to layer
    // on top of the first pass instead of wiping it - with the scene's own
    // background still attached, that second `renderer.render()` call would
    // silently re-clear the mask target first, erasing every non-priority
    // entry the first pass just drew. Nulling it here (and restoring it
    // below) keeps this mask target's clearing behavior under this class's
    // own control, same as it always was meant to be.
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
      const idColor = this.#instancedEntries.get(object as THREE.InstancedMesh);
      if (idColor) {
        const resources = this.#getInstancedResources(object as THREE.InstancedMesh);
        renderer.renderObject(
          object, objectScene, objectCamera, geometry, resources.material, group, lightsNode, clippingContext
        );

        return;
      }

      const color = this.#entryByMesh.get(object as THREE.Mesh);
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
    // the target first, so priority entries win the shared mask buffer over
    // everything the first pass already drew wherever their silhouettes
    // overlap on screen - see `ColoredOutlineEntry.priority`'s own doc
    // comment for why the first pass alone can't guarantee that. An
    // `InstancedMesh` is always redrawn here regardless of whether any of
    // its instances are actually `priority` - `priorityMaterial` discards
    // every non-priority instance's fragments itself (see
    // `InstancedMaskResources.priorityFlagAttribute`'s own doc comment), so
    // a mesh with no priority instances simply draws nothing and costs one
    // harmless all-discarded draw call.
    const hasPriority = this.#priorityMeshes.size > 0 || this.#instancedEntries.size > 0;

    if (hasPriority) {
      renderer.autoClear = false;
      renderer.setRenderObjectFunction((
        object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
        // eslint-disable-next-line max-params -- external callback contract, see comment above
      ) => {
        const idColor = this.#instancedEntries.get(object as THREE.InstancedMesh);
        if (idColor) {
          const resources = this.#getInstancedResources(object as THREE.InstancedMesh);
          renderer.renderObject(
            object, objectScene, objectCamera, geometry, resources.priorityMaterial, group, lightsNode, clippingContext
          );

          return;
        }

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

      // Third pass: the same override function (still active from just
      // above - `setRenderObjectFunction` isn't called again here) redraws
      // the same priority entries into their own fresh (cleared) target
      // instead of layering onto the shared mask - see
      // `#renderTargetPriorityMask`'s own doc comment for why this second,
      // independent chain exists.
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
    // `#priorityMaskMaterial` (see its own doc comment) since the shape is
    // identical, only the target and which entries feed it differ. No
    // "layer onto the shared mask" step at all, unlike priority - an
    // isolated entry was never in `#entryByMesh` to begin with (see
    // `setEntries`), so there is nothing there for it to win.
    const hasIsolated = this.#isolatedEntryByMesh.size > 0;

    if (hasIsolated) {
      renderer.autoClear = true;
      renderer.setRenderObjectFunction((
        object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
        // eslint-disable-next-line max-params -- external callback contract, see comment above
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
    else {
      renderer.setRenderTarget(this.#renderTargetIsolatedEdge1);
      renderer.clear();
      renderer.setRenderTarget(this.#renderTargetIsolatedEdge2);
      renderer.clear();
    }

    renderer.setRenderObjectFunction(previousRenderObjectFunction);

    // Restored here, not at the very end - leaving `scene.background`/the
    // transparent clear color set for the mask passes above in place any
    // longer than necessary risked the real scene render (`pipeline.render()`,
    // called right after this method returns) picking them up too - the
    // actual bug behind a real report of the whole 3D view going white
    // specifically whenever any entry existed (i.e. whenever this method did
    // any work at all).
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
