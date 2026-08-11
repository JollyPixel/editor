// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  Loop,
  int,
  exp,
  min,
  float,
  mul,
  uv,
  vec2,
  vec3,
  vec4,
  Fn,
  textureSize,
  orthographicDepthToViewZ,
  screenUV,
  nodeObject,
  uniform,
  passTexture,
  texture,
  perspectiveDepthToViewZ,
  positionView,
  reference,
  color,
  instancedBufferAttribute,
  If,
  Discard
} from "three/tsl";

// CONSTANTS
const kBlurDirectionX = new THREE.Vector2(1, 0);
const kBlurDirectionY = new THREE.Vector2(0, 1);
// Same separable-blur kernel radius as three's own OutlineNode.
const kMaxBlurRadius = 4;

export interface InstancedOutlineSelection {
  mesh: THREE.InstancedMesh;
  instanceId: number;
}

/**
 * Per-`InstancedMesh` GPU resources for `InstancedOutlineNode`'s instance
 * support - see `#getInstancedResources`'s own doc comment for what each one
 * does and why the flag attribute is shared between both materials.
 */
interface InstancedResources {
  /** Per-instance selected flag (`1` = selected, `0` = not), written once per frame by `#writeInstanceFlags`. */
  selectedFlagAttribute: THREE.InstancedBufferAttribute;
  /** Pass-1 (non-selected depth prepass) material - discards fragments of *selected* instances. */
  depthMaterial: THREE.NodeMaterial;
  /** Pass-2 (selected mask) material - discards fragments of *non-selected* instances, else `#prepareMask()`. */
  maskMaterial: THREE.NodeMaterial;
}

/**
 * Fork of three's own `OutlineNode` (`three/addons/tsl/display/OutlineNode.js`,
 * ported from the version shipped with three@0.185.1) extended with
 * per-instance selection support for a `THREE.InstancedMesh` - see
 * `docs/InstancedOutlineNode.md` for the full rationale on why this exists
 * as a maintained fork rather than a wrapper: the upstream algorithm checks
 * selection by `Set<Object3D>` identity in a private, non-extensible
 * `updateBefore()`, which has no seam for "some instances of this one object
 * are selected, not all of it".
 *
 * Everything not `selectedInstances`-related is intentionally kept as close
 * to upstream as possible (same render-target/material shape, same
 * two-pass depth-prepass-then-mask algorithm, same edge-detection/blur/
 * composite chain) so future three.js upgrades can be diffed against the
 * vendored source at `node_modules/three/examples/jsm/tsl/display/OutlineNode.js`
 * to see what changed upstream and reapply it here. Ported from JS to this
 * repo's TS/`#private`-field conventions; internal `_underscored` fields
 * became `#private` fields, the public surface (`scene`, `camera`,
 * `selectedObjects`, `edgeThicknessNode`, `edgeGlowNode`, `downSampleRatio`,
 * `updateBeforeType`) is unchanged.
 *
 * Most internal TSL-graph-holding fields/methods are left without an
 * explicit type annotation (relying on this repo's `noImplicitAny: false`,
 * set for exactly this reason - see AGENTS.md) rather than fighting TSL's
 * heavily-overloaded node types (`vec3`, `texture`, `reference`, ... each
 * resolve to a different concrete type per call site, which a single
 * `ReturnType<typeof X>` annotation can't express); only genuinely-public
 * fields keep real types, and casts are added only where three's own `.d.ts`
 * is stricter (or looser) than its actual runtime contract - each such cast
 * is commented with why.
 *
 * @augments THREE.TempNode
 */
export class InstancedOutlineNode extends THREE.TempNode {
  static get type(): string {
    return "InstancedOutlineNode";
  }

  scene: THREE.Scene;
  camera: THREE.Camera;
  selectedObjects: THREE.Object3D[];
  /**
   * Individual `InstancedMesh` instances to outline, alongside
   * `selectedObjects` - a whole-object selection and an instanced selection
   * can be mixed freely in the same node. Several entries may reference the
   * same `mesh`; they're merged into one per-mesh selected-instance set,
   * same as `selectedObjects` naturally merges via `Set` identity.
   */
  selectedInstances: InstancedOutlineSelection[];
  edgeThicknessNode;
  edgeGlowNode;
  downSampleRatio: number;

  #renderTargetDepthBuffer: THREE.RenderTarget;
  #renderTargetMaskBuffer: THREE.RenderTarget;
  #renderTargetMaskDownSampleBuffer: THREE.RenderTarget;
  #renderTargetEdgeBuffer1: THREE.RenderTarget;
  #renderTargetEdgeBuffer2: THREE.RenderTarget;
  #renderTargetBlurBuffer1: THREE.RenderTarget;
  #renderTargetBlurBuffer2: THREE.RenderTarget;
  #renderTargetComposite: THREE.RenderTarget;

  #cameraNear;
  #cameraFar;
  #blurDirection;
  #depthTextureUniform;
  #maskTextureUniform;
  #maskTextureDownsSampleUniform;
  #edge1TextureUniform;
  #edge2TextureUniform;
  #blurColorTextureUniform;

  #visibleEdgeColor = vec3(1, 0, 0);
  #hiddenEdgeColor = vec3(0, 1, 0);

  #depthMaterial: THREE.NodeMaterial;
  #depthSpriteMaterial: THREE.SpriteNodeMaterial;
  #prepareMaskMaterial: THREE.NodeMaterial;
  #prepareMaskSpriteMaterial: THREE.SpriteNodeMaterial;
  #materialCopy: THREE.NodeMaterial;
  #edgeDetectionMaterial: THREE.NodeMaterial;
  #separableBlurMaterial: THREE.NodeMaterial;
  #separableBlurMaterial2: THREE.NodeMaterial;
  #compositeMaterial: THREE.NodeMaterial;

  #selectionCache = new Set<THREE.Object3D>();
  /** Per `InstancedMesh`, the set of currently-selected instance ids - rebuilt every frame by `#updateSelectionCache`. */
  #instanceSelectionCache = new Map<THREE.InstancedMesh, Set<number>>();
  /** Lazily-built, reused across frames - see `#getInstancedResources`'s own doc comment. */
  #instancedResources = new Map<THREE.InstancedMesh, InstancedResources>();
  #lastSelectionCount = 0;

  #textureNode;
  #quadMesh = new THREE.QuadMesh();
  #size = new THREE.Vector2();
  // Opaque state bag three's own RendererUtils reuses across reset/restore
  // call pairs - `undefined` on the first call, same as upstream's own
  // module-level `let _rendererState;` (see `RendererUtils.resetRendererState`'s
  // own runtime, which creates a fresh state when given `undefined` despite
  // its `.d.ts` param not being marked optional).
  #rendererState: THREE.RendererUtils.RendererState | undefined;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    params: {
      selectedObjects?: THREE.Object3D[];
      selectedInstances?: InstancedOutlineSelection[];
      /** Plain number or an already-built node (e.g. a `uniform()`, for a caller that wants to animate it live). */
      edgeThickness?: Parameters<typeof nodeObject>[0];
      /** Plain number or an already-built node - see `edgeThickness`. */
      edgeGlow?: Parameters<typeof nodeObject>[0];
      downSampleRatio?: number;
    } = {}
  ) {
    super("vec4");

    const {
      selectedObjects = [],
      selectedInstances = [],
      edgeThickness = float(1),
      edgeGlow = float(0),
      downSampleRatio = 2
    } = params;

    this.scene = scene;
    this.camera = camera;
    this.selectedObjects = selectedObjects;
    this.selectedInstances = selectedInstances;
    this.edgeThicknessNode = nodeObject(edgeThickness);
    this.edgeGlowNode = nodeObject(edgeGlow);
    this.downSampleRatio = downSampleRatio;
    this.updateBeforeType = THREE.NodeUpdateType.FRAME;

    this.#renderTargetDepthBuffer = new THREE.RenderTarget();
    this.#renderTargetDepthBuffer.depthTexture = new THREE.DepthTexture();
    this.#renderTargetDepthBuffer.depthTexture.type = THREE.FloatType;

    this.#renderTargetMaskBuffer = new THREE.RenderTarget();
    this.#renderTargetMaskDownSampleBuffer = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetEdgeBuffer1 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetEdgeBuffer2 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetBlurBuffer1 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetBlurBuffer2 = new THREE.RenderTarget(1, 1, { depthBuffer: false });
    this.#renderTargetComposite = new THREE.RenderTarget(1, 1, { depthBuffer: false });

    this.#cameraNear = reference("near", "float", camera);
    this.#cameraFar = reference("far", "float", camera);
    this.#blurDirection = uniform(new THREE.Vector2());

    this.#depthTextureUniform = texture(this.#renderTargetDepthBuffer.depthTexture);
    this.#maskTextureUniform = texture(this.#renderTargetMaskBuffer.texture);
    this.#maskTextureDownsSampleUniform = texture(this.#renderTargetMaskDownSampleBuffer.texture);
    this.#edge1TextureUniform = texture(this.#renderTargetEdgeBuffer1.texture);
    this.#edge2TextureUniform = texture(this.#renderTargetEdgeBuffer2.texture);
    this.#blurColorTextureUniform = texture(this.#renderTargetEdgeBuffer1.texture);

    this.#depthMaterial = new THREE.NodeMaterial();
    this.#depthMaterial.colorNode = color(0, 0, 0);
    this.#depthMaterial.name = "InstancedOutlineNode.depth";

    this.#depthSpriteMaterial = new THREE.SpriteNodeMaterial();
    this.#depthSpriteMaterial.colorNode = color(0, 0, 0);
    this.#depthSpriteMaterial.name = "InstancedOutlineNode.depthSprite";

    this.#prepareMaskMaterial = new THREE.NodeMaterial();
    this.#prepareMaskMaterial.name = "InstancedOutlineNode.prepareMask";

    this.#prepareMaskSpriteMaterial = new THREE.SpriteNodeMaterial();
    this.#prepareMaskSpriteMaterial.name = "InstancedOutlineNode.prepareMaskSprite";

    this.#materialCopy = new THREE.NodeMaterial();
    this.#materialCopy.name = "InstancedOutlineNode.copy";

    this.#edgeDetectionMaterial = new THREE.NodeMaterial();
    this.#edgeDetectionMaterial.name = "InstancedOutlineNode.edgeDetection";

    this.#separableBlurMaterial = new THREE.NodeMaterial();
    this.#separableBlurMaterial.name = "InstancedOutlineNode.separableBlur";

    this.#separableBlurMaterial2 = new THREE.NodeMaterial();
    this.#separableBlurMaterial2.name = "InstancedOutlineNode.separableBlur2";

    this.#compositeMaterial = new THREE.NodeMaterial();
    this.#compositeMaterial.name = "InstancedOutlineNode.composite";

    // `passTexture()`'s `.d.ts` wants a `PassNode` specifically, but (same
    // as upstream's own `passTexture(this, ...)`) any `TempNode` works at
    // runtime - the parameter is only ever used as a dependency reference.
    this.#textureNode = passTexture(this as unknown as THREE.PassNode, this.#renderTargetComposite.texture);
  }

  get visibleEdge() {
    return (this as unknown as ReturnType<typeof vec4>).r;
  }

  get hiddenEdge() {
    return (this as unknown as ReturnType<typeof vec4>).g;
  }

  getTextureNode() {
    return this.#textureNode;
  }

  setSize(
    width: number,
    height: number
  ): void {
    this.#renderTargetDepthBuffer.setSize(width, height);
    this.#renderTargetMaskBuffer.setSize(width, height);
    this.#renderTargetComposite.setSize(width, height);

    let resx = Math.round(width / this.downSampleRatio);
    let resy = Math.round(height / this.downSampleRatio);

    this.#renderTargetMaskDownSampleBuffer.setSize(resx, resy);
    this.#renderTargetEdgeBuffer1.setSize(resx, resy);
    this.#renderTargetBlurBuffer1.setSize(resx, resy);

    resx = Math.round(resx / 2);
    resy = Math.round(resy / 2);

    this.#renderTargetEdgeBuffer2.setSize(resx, resy);
    this.#renderTargetBlurBuffer2.setSize(resx, resy);
  }

  /**
   * Runs the effect once per frame: two passes (non-selected depth, then
   * selected mask) followed by the fixed downsample/edge-detect/blur/
   * composite chain - unchanged from upstream except that both passes now
   * also handle any `InstancedMesh` referenced by `selectedInstances`, via
   * `#getInstancedResources`'s per-mesh materials instead of the shared
   * whole-object ones.
   */
  override updateBefore(
    frame: THREE.NodeFrame
  ): undefined {
    const { renderer } = frame;
    if (!renderer) {
      return;
    }
    const { camera, scene } = this;

    this.#updateSelectionCache();

    if (this.#selectionCache.size === 0 && this.#instanceSelectionCache.size === 0) {
      if (this.#lastSelectionCount > 0) {
        // `this.#rendererState` is legitimately `undefined` on the very
        // first call in the app's lifetime - `resetRendererState` handles
        // that at runtime by creating a fresh state (same as upstream's own
        // module-level `let _rendererState;`), despite its `.d.ts` param not
        // being marked optional; `!` reflects that runtime contract, not a
        // guarantee true at the type level.
        this.#rendererState = THREE.RendererUtils.resetRendererState(renderer, this.#rendererState!);

        renderer.setRenderTarget(this.#renderTargetComposite);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();

        THREE.RendererUtils.restoreRendererState(renderer, this.#rendererState);

        this.#lastSelectionCount = 0;
      }

      return;
    }

    this.#lastSelectionCount = this.#selectionCache.size + this.#instanceSelectionCache.size;

    // `resetRendererAndSceneState`'s `.d.ts` declares a 2-param
    // `(renderer, state: RendererAndSceneState) => RendererAndSceneState`
    // shape that doesn't match its actual runtime signature (see
    // `RendererUtils.js`: `(renderer, scene, state)`, 3 params) - a real gap
    // between three's own declared and actual contract, not something a
    // narrower cast can bridge, hence `unknown` first as TS itself suggests.
    this.#rendererState = (THREE.RendererUtils.resetRendererAndSceneState as unknown as (
      ...args: [THREE.Renderer, THREE.Scene, THREE.RendererUtils.RendererState | undefined]
    ) => THREE.RendererUtils.RendererState)(renderer, scene, this.#rendererState);

    const size = renderer.getDrawingBufferSize(this.#size);
    this.setSize(size.width, size.height);

    renderer.setClearColor(0xffffff, 1);

    const currentSceneName = scene.name;

    // 1. Draw non-selected objects (and non-selected instances of any
    // partially-selected InstancedMesh) into the depth buffer.

    renderer.setRenderTarget(this.#renderTargetDepthBuffer);
    renderer.setRenderObjectFunction((
      object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
      // eslint-disable-next-line max-params -- external Renderer.setRenderObjectFunction callback contract
    ) => {
      const instancedMesh = object as THREE.InstancedMesh;
      const resources = this.#instanceSelectionCache.has(instancedMesh) ?
        this.#getInstancedResources(instancedMesh) :
        null;

      if (resources) {
        renderer.renderObject(
          object, objectScene, objectCamera, geometry, resources.depthMaterial, group, lightsNode, clippingContext
        );

        return;
      }

      if (this.#selectionCache.has(object) === false) {
        const overrideMaterial = (object as THREE.Sprite).isSprite ? this.#depthSpriteMaterial : this.#depthMaterial;
        renderer.renderObject(object, objectScene, objectCamera, geometry, overrideMaterial, group, lightsNode, clippingContext);
      }
    });

    scene.name = "InstancedOutline [ Non-Selected Objects Pass ]";
    renderer.render(scene, camera);

    // 2. Draw only the selected objects (and selected instances) by
    // comparing against the depth buffer of everything else.

    renderer.setRenderTarget(this.#renderTargetMaskBuffer);
    renderer.setRenderObjectFunction((
      object, objectScene, objectCamera, geometry, _material, group, lightsNode, clippingContext
      // eslint-disable-next-line max-params -- external Renderer.setRenderObjectFunction callback contract
    ) => {
      const instancedMesh = object as THREE.InstancedMesh;
      const resources = this.#instanceSelectionCache.has(instancedMesh) ?
        this.#getInstancedResources(instancedMesh) :
        null;

      if (resources) {
        renderer.renderObject(
          object, objectScene, objectCamera, geometry, resources.maskMaterial, group, lightsNode, clippingContext
        );

        return;
      }

      if (this.#selectionCache.has(object) === true) {
        const overrideMaterial = (object as THREE.Sprite).isSprite ?
          this.#prepareMaskSpriteMaterial :
          this.#prepareMaskMaterial;
        renderer.renderObject(object, objectScene, objectCamera, geometry, overrideMaterial, group, lightsNode, clippingContext);
      }
    });

    scene.name = "InstancedOutline [ Selected Objects Pass ]";
    renderer.render(scene, camera);

    // `RendererState.renderObjectFunction`'s stored type doesn't exactly
    // match `setRenderObjectFunction`'s own parameter type (missing the
    // optional trailing `passId`) - same function shape at runtime, just a
    // gap between three's own internal types.
    renderer.setRenderObjectFunction(this.#rendererState!.renderObjectFunction as never);

    this.#selectionCache.clear();
    this.#instanceSelectionCache.clear();

    scene.name = currentSceneName;

    // 3. Downsample to (at least) half resolution

    this.#quadMesh.material = this.#materialCopy;
    this.#quadMesh.name = "InstancedOutline [ Downsample ]";
    renderer.setRenderTarget(this.#renderTargetMaskDownSampleBuffer);
    this.#quadMesh.render(renderer);

    // 4. Perform edge detection (half resolution)

    this.#quadMesh.material = this.#edgeDetectionMaterial;
    this.#quadMesh.name = "InstancedOutline [ Edge Detection ]";
    renderer.setRenderTarget(this.#renderTargetEdgeBuffer1);
    this.#quadMesh.render(renderer);

    // 5. Apply blur (half resolution)

    this.#blurColorTextureUniform.value = this.#renderTargetEdgeBuffer1.texture;
    this.#blurDirection.value.copy(kBlurDirectionX);

    this.#quadMesh.material = this.#separableBlurMaterial;
    this.#quadMesh.name = "InstancedOutline [ Blur Half Resolution ]";
    renderer.setRenderTarget(this.#renderTargetBlurBuffer1);
    this.#quadMesh.render(renderer);

    this.#blurColorTextureUniform.value = this.#renderTargetBlurBuffer1.texture;
    this.#blurDirection.value.copy(kBlurDirectionY);

    renderer.setRenderTarget(this.#renderTargetEdgeBuffer1);
    this.#quadMesh.render(renderer);

    // 6. Apply blur (quarter resolution)

    this.#blurColorTextureUniform.value = this.#renderTargetEdgeBuffer1.texture;
    this.#blurDirection.value.copy(kBlurDirectionX);

    this.#quadMesh.material = this.#separableBlurMaterial2;
    this.#quadMesh.name = "InstancedOutline [ Blur Quarter Resolution ]";
    renderer.setRenderTarget(this.#renderTargetBlurBuffer2);
    this.#quadMesh.render(renderer);

    this.#blurColorTextureUniform.value = this.#renderTargetBlurBuffer2.texture;
    this.#blurDirection.value.copy(kBlurDirectionY);

    renderer.setRenderTarget(this.#renderTargetEdgeBuffer2);
    this.#quadMesh.render(renderer);

    // 7. Composite

    this.#quadMesh.material = this.#compositeMaterial;
    this.#quadMesh.name = "InstancedOutline [ Composite ]";
    renderer.setRenderTarget(this.#renderTargetComposite);
    this.#quadMesh.render(renderer);

    // Same `.d.ts` gap as `resetRendererAndSceneState` above.
    (THREE.RendererUtils.restoreRendererAndSceneState as unknown as (
      ...args: [THREE.Renderer, THREE.Scene, THREE.RendererUtils.RendererState]
    ) => void)(renderer, scene, this.#rendererState!);
  }

  override setup() {
    this.#prepareMaskMaterial.colorNode = this.#prepareMask();
    this.#prepareMaskMaterial.needsUpdate = true;

    this.#prepareMaskSpriteMaterial.colorNode = this.#prepareMask();
    this.#prepareMaskSpriteMaterial.needsUpdate = true;

    this.#materialCopy.fragmentNode = this.#maskTextureUniform;
    this.#materialCopy.needsUpdate = true;

    this.#edgeDetectionMaterial.fragmentNode = this.#buildEdgeDetection();
    this.#edgeDetectionMaterial.needsUpdate = true;

    this.#separableBlurMaterial.fragmentNode = this.#buildSeparableBlur(this.edgeThicknessNode);
    this.#separableBlurMaterial.needsUpdate = true;

    this.#separableBlurMaterial2.fragmentNode = this.#buildSeparableBlur(float(kMaxBlurRadius));
    this.#separableBlurMaterial2.needsUpdate = true;

    this.#compositeMaterial.fragmentNode = this.#buildComposite();
    this.#compositeMaterial.needsUpdate = true;

    return this.#textureNode;
  }

  override dispose(): void {
    this.selectedObjects.length = 0;
    this.selectedInstances.length = 0;

    this.#renderTargetDepthBuffer.dispose();
    this.#renderTargetMaskBuffer.dispose();
    this.#renderTargetMaskDownSampleBuffer.dispose();
    this.#renderTargetEdgeBuffer1.dispose();
    this.#renderTargetEdgeBuffer2.dispose();
    this.#renderTargetBlurBuffer1.dispose();
    this.#renderTargetBlurBuffer2.dispose();
    this.#renderTargetComposite.dispose();

    this.#depthMaterial.dispose();
    this.#depthSpriteMaterial.dispose();
    this.#prepareMaskMaterial.dispose();
    this.#prepareMaskSpriteMaterial.dispose();
    this.#materialCopy.dispose();
    this.#edgeDetectionMaterial.dispose();
    this.#separableBlurMaterial.dispose();
    this.#separableBlurMaterial2.dispose();
    this.#compositeMaterial.dispose();

    for (const resources of this.#instancedResources.values()) {
      resources.depthMaterial.dispose();
      resources.maskMaterial.dispose();
    }
    this.#instancedResources.clear();
  }

  /**
   * Rebuilds `#selectionCache` from `selectedObjects` (unchanged from
   * upstream) and `#instanceSelectionCache` from `selectedInstances`, then
   * writes every referenced mesh's `selectedFlagAttribute` for this frame -
   * once here rather than inside each render-object-function, since both
   * passes read the same, already-correct flags for a given mesh.
   */
  #updateSelectionCache(): void {
    for (const selectedObject of this.selectedObjects) {
      selectedObject.traverse((object) => {
        if ((object as THREE.Mesh).isMesh || (object as THREE.Sprite).isSprite) {
          this.#selectionCache.add(object);
        }
      });
    }

    for (const { mesh, instanceId } of this.selectedInstances) {
      let ids = this.#instanceSelectionCache.get(mesh);
      if (!ids) {
        ids = new Set();
        this.#instanceSelectionCache.set(mesh, ids);
      }
      ids.add(instanceId);
    }

    for (const [mesh, ids] of this.#instanceSelectionCache) {
      this.#writeInstanceFlags(mesh, ids);
    }
  }

  /**
   * Lazily builds (and rebuilds if `mesh.count` has since changed) the two
   * materials + shared flag attribute one partially-selected `InstancedMesh`
   * needs - reused and just rewritten across frames, so re-selecting a
   * different subset of the same mesh's instances never costs a new shader
   * compile. Not `mesh.instanceColor` - same reasoning as
   * `ColoredOutlinePass`'s own `#getInstancedResources` (see its doc
   * comment): three auto-multiplies *any* material's diffuse color by
   * `instanceColor` when it's set, which would leak into this mesh's normal
   * scene rendering.
   */
  #getInstancedResources(
    mesh: THREE.InstancedMesh
  ): InstancedResources {
    const cached = this.#instancedResources.get(mesh);
    if (cached && cached.selectedFlagAttribute.count === mesh.count) {
      return cached;
    }
    cached?.depthMaterial.dispose();
    cached?.maskMaterial.dispose();

    const selectedFlagAttribute = new THREE.InstancedBufferAttribute(new Float32Array(mesh.count), 1);

    function selectedFlagNode(): ReturnType<typeof float> {
      return instancedBufferAttribute(selectedFlagAttribute, "float") as unknown as ReturnType<typeof float>;
    }

    // Pass 1: this mesh's contribution to "the world minus the selection" -
    // draw every instance's depth except the selected ones, same intent as
    // upstream's whole-object exclusion via `#selectionCache.has(object)`.
    const depthMaterial = new THREE.NodeMaterial();
    depthMaterial.name = "InstancedOutlineNode.instancedDepth";
    depthMaterial.colorNode = Fn(() => {
      If(selectedFlagNode().greaterThanEqual(0.5), () => {
        Discard();
      });

      return color(0, 0, 0);
    })();

    // Pass 2: only the selected instances, comparing against pass 1's depth
    // buffer via the exact same `#prepareMask()` expression the whole-object
    // materials use.
    const maskMaterial = new THREE.NodeMaterial();
    maskMaterial.name = "InstancedOutlineNode.instancedMask";
    maskMaterial.colorNode = Fn(() => {
      If(selectedFlagNode().lessThan(0.5), () => {
        Discard();
      });

      return this.#prepareMask();
    })();

    const resources: InstancedResources = { selectedFlagAttribute, depthMaterial, maskMaterial };
    this.#instancedResources.set(mesh, resources);

    return resources;
  }

  #writeInstanceFlags(
    mesh: THREE.InstancedMesh,
    selectedIds: Set<number>
  ): void {
    const resources = this.#getInstancedResources(mesh);
    resources.selectedFlagAttribute.array.fill(0);
    for (const instanceId of selectedIds) {
      resources.selectedFlagAttribute.array[instanceId] = 1;
    }
    resources.selectedFlagAttribute.needsUpdate = true;
  }

  /**
   * Per-fragment "is this nearer than the non-selected-world depth buffer"
   * test, encoded as `vec3(0, depthTest, 1)` to match `visibleEdge`/
   * `hiddenEdge`'s own channel convention (`.r`/`.g`) - unchanged from
   * upstream, extracted into its own method (instead of a `setup()`-local
   * closure) so `#getInstancedResources`'s per-mesh mask material can reuse
   * the exact same expression instead of duplicating it.
   */
  #prepareMask() {
    const depth = this.#depthTextureUniform.sample(screenUV);

    const viewZNode = this.camera instanceof THREE.PerspectiveCamera ?
      perspectiveDepthToViewZ(depth, this.#cameraNear, this.#cameraFar) :
      orthographicDepthToViewZ(depth, this.#cameraNear, this.#cameraFar);

    const depthTest = positionView.z.lessThanEqual(viewZNode).select(1, 0);

    return vec3(0, depthTest, 1);
  }

  #buildEdgeDetection() {
    return Fn(() => {
      // `textureSize()` returns a concrete `TextureSizeNode`, not the
      // generic `Node<"vec2">` shape `.div()`/`.mul()` expect - same
      // declared-vs-actual gap as the other casts in this file.
      const resolution = textureSize(this.#maskTextureDownsSampleUniform) as unknown as ReturnType<typeof vec2>;
      const invSize = vec2(1).div(resolution).toVar();
      const uvOffset = vec4(1, 0, 0, 1).mul(vec4(invSize, invSize));

      const uvNode = uv();
      const c1 = this.#maskTextureDownsSampleUniform.sample(uvNode.add(uvOffset.xy)).toVar();
      const c2 = this.#maskTextureDownsSampleUniform.sample(uvNode.sub(uvOffset.xy)).toVar();
      const c3 = this.#maskTextureDownsSampleUniform.sample(uvNode.add(uvOffset.yw)).toVar();
      const c4 = this.#maskTextureDownsSampleUniform.sample(uvNode.sub(uvOffset.yw)).toVar();

      const diff1 = mul(c1.r.sub(c2.r), 0.5);
      const diff2 = mul(c3.r.sub(c4.r), 0.5);
      const d = vec2(diff1, diff2).length();
      const a1 = min(c1.g, c2.g);
      const a2 = min(c3.g, c4.g);
      const visibilityFactor = min(a1, a2);
      const edgeColor = visibilityFactor.oneMinus().greaterThan(0.001).select(this.#visibleEdgeColor, this.#hiddenEdgeColor);

      return vec4(edgeColor, 1).mul(d);
    })();
  }

  // `kernelRadius` is deliberately untyped (`noImplicitAny` is off for
  // exactly this reason, see AGENTS.md) - called with both `edgeThicknessNode`
  // (whatever `nodeObject(float(...))` resolves to) and a plain `float(...)`,
  // two different concrete TSL node types no single annotation covers.
  #buildSeparableBlur(
    kernelRadius
  ) {
    return Fn(() => {
      // `textureSize()` returns a concrete `TextureSizeNode`, not the
      // generic `Node<"vec2">` shape `.div()`/`.mul()` expect - same
      // declared-vs-actual gap as the other casts in this file.
      const resolution = textureSize(this.#maskTextureDownsSampleUniform) as unknown as ReturnType<typeof vec2>;
      const invSize = vec2(1).div(resolution).toVar();
      const uvNode = uv();

      const sigma = kernelRadius.div(2).toVar();
      const weightSum = gaussianPdf(float(0), sigma).toVar();
      const diffuseSum = this.#blurColorTextureUniform.sample(uvNode).mul(weightSum).toVar();
      const delta = this.#blurDirection.mul(invSize).mul(kernelRadius).div(kMaxBlurRadius).toVar();

      const uvOffset = delta.toVar();

      Loop({ start: int(1), end: int(kMaxBlurRadius), type: "int", condition: "<=" }, ({ i }) => {
        const x = kernelRadius.mul(float(i)).div(kMaxBlurRadius);
        const w = gaussianPdf(x, sigma);
        const sample1 = this.#blurColorTextureUniform.sample(uvNode.add(uvOffset));
        const sample2 = this.#blurColorTextureUniform.sample(uvNode.sub(uvOffset));

        diffuseSum.addAssign(sample1.add(sample2).mul(w));
        weightSum.addAssign(w.mul(2));
        uvOffset.addAssign(delta);
      });

      return diffuseSum.div(weightSum);
    })();
  }

  #buildComposite() {
    return Fn(() => {
      const edgeValue1 = this.#edge1TextureUniform;
      const edgeValue2 = this.#edge2TextureUniform;
      const maskColor = this.#maskTextureUniform;

      const edgeValue = edgeValue1.add(edgeValue2.mul(this.edgeGlowNode));

      return maskColor.r.mul(edgeValue);
    })();
  }
}

// `x`/`sigma` deliberately untyped, same reasoning as `#buildSeparableBlur`'s
// own `kernelRadius` param just above - called with several different
// concrete TSL node types depending on the call site.
function gaussianPdf(
  x,
  sigma
) {
  return float(0.39894).mul(exp(float(-0.5).mul(x).mul(x).div(sigma.mul(sigma))).div(sigma));
}

/**
 * TSL factory, matching three's own lower-case `outline()` convention -
 * `ToonOutlinePass` calls this the same way it would call `outline()`.
 */
export function instancedOutline(
  scene: THREE.Scene,
  camera: THREE.Camera,
  params?: ConstructorParameters<typeof InstancedOutlineNode>[2]
): InstancedOutlineNode {
  return new InstancedOutlineNode(scene, camera, params);
}
