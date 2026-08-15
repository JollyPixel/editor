// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  pass,
  uniform,
  float,
  vec3
} from "three/tsl";

// Import Internal Dependencies
import type { SelectionManager, SelectableObject } from "../SelectionManager.ts";
import { instancedOutline, type InstancedOutlineSelection } from "./InstancedOutlineNode.ts";

/**
 * A `SelectableObject` (whole-object outline) or a single instance of a
 * `THREE.InstancedMesh` - see `InstancedOutlineNode`'s own doc comment for
 * why an `InstancedMesh` needs picking out one instance rather than being
 * outlined as a whole.
 */
export type ToonOutlineTarget = SelectableObject | InstancedOutlineSelection;

function isInstancedTarget(
  target: ToonOutlineTarget
): target is InstancedOutlineSelection {
  return "mesh" in target && "instanceId" in target;
}

/**
 * Splits a flat list of mixed whole-object/instanced targets into the two
 * parallel lists `InstancedOutlineNode` itself keeps
 * (`selectedObjects`/`selectedInstances`).
 */
function splitTargets(
  targets: ToonOutlineTarget[]
): { objects: SelectableObject[]; instances: InstancedOutlineSelection[]; } {
  const objects: SelectableObject[] = [];
  const instances: InstancedOutlineSelection[] = [];

  for (const target of targets) {
    if (isInstancedTarget(target)) {
      instances.push(target);
    }
    else {
      objects.push(target);
    }
  }

  return { objects, instances };
}

export interface ToonOutlinePassOptions {
  /**
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * @default "#8ab4f8"
   */
  hoverColor?: THREE.ColorRepresentation;
  /**
   * Multiplies the hover outline's strength, the same role `opacity` plays
   * for `SelectionOutline`/`SelectionHighlight`'s own hover overlay.
   * @default 0.35
   */
  hoverOpacity?: number;
  /**
   * Color used for the portion of the outline occluded by other geometry -
   * shared by both the selected and hover outline (unlike `color`/
   * `hoverColor`, which stay distinct per role). Always computed and
   * composited; `xray` below only gates whether it contributes anything, not
   * which color it uses. Matches `InstancedOutlineNode`'s own visible/hidden
   * edge color split.
   * @default "#404040"
   */
  hiddenColor?: THREE.ColorRepresentation;
  /**
   * Detected-edge thickness, in downsampled pixels - forwarded straight to
   * `InstancedOutlineNode`'s own `edgeThickness` parameter. Adjustable at
   * runtime via `setEdgeThickness`.
   * @default 1
   */
  edgeThickness?: number;
  /**
   * Animated glow/pulse multiplier on the blurred outer ring - forwarded
   * straight to `InstancedOutlineNode`'s own `edgeGlow` parameter.
   * @default 0
   */
  edgeGlow?: number;
  /**
   * Resolution divisor the edge-detection/blur passes run at - forwarded
   * straight to `InstancedOutlineNode`'s own `downSampleRatio` parameter.
   * Higher is cheaper but blurs the outline more.
   * @default 2
   */
  downSampleRatio?: number;
  /**
   * Keeps the outline visible through occluding geometry (an X-ray look,
   * colored `hiddenColor`) instead of only along the target's actual
   * silhouette - the postprocess equivalent of
   * `SelectionOutline`/`SelectionHighlight`'s own `xray` option. Adjustable
   * at runtime via `setXray`.
   * @default false
   */
  xray?: boolean;
}

/**
 * Scene-level selection outline built on `InstancedOutlineNode` (this
 * package's own fork of three's node-based, `WebGPURenderer`-only
 * `OutlineNode` - the successor to the classic `EffectComposer`
 * `OutlinePass`, which is `WebGLRenderer`-only and unavailable here - see
 * `InstancedOutlineNode`'s own doc comment for why it's a maintained fork
 * rather than the vendored addon directly): a mask pass plus edge detection
 * over the whole rendered frame, rather than a mesh decorated with its own
 * overlay geometry like `SelectionOutline`/`SelectionHighlight`. That makes
 * it a natural fit for a "toon" outline look (a flat-colored rim independent
 * of the target's own material/shading) and gives group outlining for free -
 * a whole-object target traverses to every mesh inside it, so a
 * `THREE.Group` outlines every mesh inside it, unlike
 * `SelectionBoundingBox`'s box approximation. A target can also be a single
 * instance of a `THREE.InstancedMesh` (`ToonOutlineTarget`'s own doc
 * comment) - `setSelected`/`setSelectedMany`/`setHovered` route each kind to
 * `InstancedOutlineNode`'s matching list automatically.
 *
 * Deliberately outside `SelectionManager`'s own overlay model: that model
 * disposes/rebuilds a small per-object child (`SelectionOutline` /
 * `SelectionHighlight` / `SelectionBoundingBox`) per id, which has no
 * equivalent here since a postprocess outline is one pipeline shared by the
 * whole scene, driven by a selected/hovered object list rather than owning
 * per-id instances. `sync` bridges the two by mirroring `SelectionManager`'s
 * state onto that list live, without changing `SelectionManager` itself -
 * `SelectionManager` has no notion of an instanced target, so `sync` only
 * ever mirrors whole-object selections.
 *
 * Replaces `renderer.render(scene, camera)` in the render loop with this
 * class's own `render()` - `THREE.RenderPipeline` requires that instead of
 * the renderer's own `render()` once anything is piped through it.
 */
export class ToonOutlinePass {
  readonly pipeline: THREE.RenderPipeline;

  #selectedOutline: ReturnType<typeof instancedOutline>;
  #hoverOutline: ReturnType<typeof instancedOutline>;

  /**
   * Plain `THREE.Color`/number/boolean state kept alongside (rather than
   * read back from) the matching uniform node below - a TSL `UniformNode`'s
   * `.value` type-checks as `unknown` once passed through the node-graph
   * composition in the constructor, so reading state back through it would
   * need a cast on every getter. `#color`/`#hoverColor`/`#hiddenColor` are
   * the exact object `uniform()` stores as that uniform's `.value` (by
   * reference, not a copy), so `.set()`-ing them in place also updates what
   * the GPU reads; `#hoverOpacity`/`#edgeThickness`/`#xray` are plain
   * values, so their setters below write both this field and the matching
   * uniform's `.value` explicitly.
   */
  #color: THREE.Color;
  #hoverColor: THREE.Color;
  #hiddenColor: THREE.Color;
  #hoverOpacity: number;
  #edgeThickness: number;
  #xray: boolean;

  #colorUniform: ReturnType<typeof uniform>;
  #hoverColorUniform: ReturnType<typeof uniform>;
  #hiddenColorUniform: ReturnType<typeof uniform>;
  #hoverOpacityUniform: ReturnType<typeof uniform>;
  #edgeThicknessUniform: ReturnType<typeof uniform>;
  #xrayUniform: ReturnType<typeof uniform>;

  #manager: SelectionManager | null = null;
  #onSelectionChange = (): void => this.#syncSelected();
  #onHoverChange = (): void => this.#syncHovered();

  constructor(
    renderer: THREE.WebGPURenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    options: ToonOutlinePassOptions = {}
  ) {
    const {
      color = "#ffffff",
      hoverColor = "#8ab4f8",
      hiddenColor = "#404040",
      hoverOpacity = 0.35,
      edgeThickness = 1,
      edgeGlow = 0,
      downSampleRatio = 2,
      xray = false
    } = options;

    this.#color = new THREE.Color(color);
    this.#hoverColor = new THREE.Color(hoverColor);
    this.#hiddenColor = new THREE.Color(hiddenColor);
    this.#hoverOpacity = hoverOpacity;
    this.#edgeThickness = edgeThickness;
    this.#xray = xray;

    this.#colorUniform = uniform(this.#color);
    this.#hoverColorUniform = uniform(this.#hoverColor);
    this.#hiddenColorUniform = uniform(this.#hiddenColor);
    this.#hoverOpacityUniform = uniform(this.#hoverOpacity);
    this.#edgeThicknessUniform = uniform(this.#edgeThickness);
    this.#xrayUniform = uniform(xray ? 1 : 0);

    // `uniform()`'s return type-checks as an untagged `UniformNode<unknown>`
    // (its JSDoc return type isn't parameterized by the value/type argument
    // given), which TSL's fluent `.mul()`/`.add()` overloads can't resolve
    // as an argument - the cast tells TypeScript the concrete node type
    // `uniform()` actually builds at runtime (a "color" value gives a vec3
    // node, a plain number a float node), same value, same live reference,
    // just narrowed for the type checker.
    const colorNode = this.#colorUniform as unknown as ReturnType<typeof vec3>;
    const hoverColorNode = this.#hoverColorUniform as unknown as ReturnType<typeof vec3>;
    const hiddenColorNode = this.#hiddenColorUniform as unknown as ReturnType<typeof vec3>;
    const hoverOpacityNode = this.#hoverOpacityUniform as unknown as ReturnType<typeof float>;
    const edgeThicknessNode = this.#edgeThicknessUniform as unknown as ReturnType<typeof float>;
    const xrayNode = this.#xrayUniform as unknown as ReturnType<typeof float>;
    const edgeGlowNode = float(edgeGlow);

    this.#selectedOutline = instancedOutline(scene, camera, {
      selectedObjects: [],
      selectedInstances: [],
      edgeThickness: edgeThicknessNode,
      edgeGlow: edgeGlowNode,
      downSampleRatio
    });
    this.#hoverOutline = instancedOutline(scene, camera, {
      selectedObjects: [],
      selectedInstances: [],
      edgeThickness: edgeThicknessNode,
      edgeGlow: edgeGlowNode,
      downSampleRatio
    });

    // Matches OutlineNode's own documented composition pattern (fluent
    // `.mul()`/`.add()` off the float `visibleEdge`/`hiddenEdge` masks,
    // ending in `outlineColor.add(scenePass)`). The occluded portion always
    // uses `hiddenColorNode` (not `colorNode`/`hoverColorNode`) - `xray`
    // only gates whether it contributes at all, see `hiddenColor`'s own doc
    // comment on `ToonOutlinePassOptions`.
    const selectedEdge = this.#selectedOutline.visibleEdge.mul(colorNode)
      .add(this.#selectedOutline.hiddenEdge.mul(hiddenColorNode).mul(xrayNode));
    const hoverEdge = this.#hoverOutline.visibleEdge.mul(hoverColorNode)
      .add(this.#hoverOutline.hiddenEdge.mul(hiddenColorNode).mul(xrayNode))
      .mul(hoverOpacityNode);

    this.pipeline = new THREE.RenderPipeline(renderer);
    this.pipeline.outputNode = selectedEdge.add(hoverEdge).add(pass(scene, camera));
  }

  /**
   * Renders the scene through the outline pipeline. Call this instead of
   * `renderer.render(scene, camera)` in the render loop.
   */
  render(): void {
    this.pipeline.render();
  }

  get color(): THREE.Color {
    return this.#color;
  }

  setColor(
    color: THREE.ColorRepresentation
  ): void {
    this.#color.set(color);
  }

  get hoverColor(): THREE.Color {
    return this.#hoverColor;
  }

  setHoverColor(
    color: THREE.ColorRepresentation
  ): void {
    this.#hoverColor.set(color);
  }

  get hiddenColor(): THREE.Color {
    return this.#hiddenColor;
  }

  setHiddenColor(
    color: THREE.ColorRepresentation
  ): void {
    this.#hiddenColor.set(color);
  }

  get hoverOpacity(): number {
    return this.#hoverOpacity;
  }

  setHoverOpacity(
    opacity: number
  ): void {
    this.#hoverOpacity = opacity;
    this.#hoverOpacityUniform.value = opacity;
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

  get xray(): boolean {
    return this.#xray;
  }

  /**
   * Toggles the X-ray look described on `ToonOutlinePassOptions.xray`.
   * Cheap - only flips a uniform, no pipeline/material rebuild.
   */
  setXray(
    xray: boolean
  ): void {
    this.#xray = xray;
    this.#xrayUniform.value = xray ? 1 : 0;
  }

  get selected(): ToonOutlineTarget | null {
    return this.#selectedOutline.selectedObjects[0] ?? this.#selectedOutline.selectedInstances[0] ?? null;
  }

  /**
   * Outlines `target` (a whole object, or a single instance of a
   * `THREE.InstancedMesh` - see `ToonOutlineTarget`'s own doc comment) with
   * the "selected" color, or clears the selected outline entirely when
   * `null`. A group outlines every mesh inside it - see this class's own doc
   * comment for why.
   */
  setSelected(
    target: ToonOutlineTarget | null
  ): void {
    const { objects, instances } = target ? splitTargets([target]) : { objects: [], instances: [] };
    this.#selectedOutline.selectedObjects = objects;
    this.#selectedOutline.selectedInstances = instances;
  }

  /**
   * Same as `setSelected`, but for many simultaneous targets at once -
   * `InstancedOutlineNode`'s own `selectedObjects`/`selectedInstances`
   * (backing `#selectedOutline`) are already arrays; `setSelected` just
   * narrows to at most one of each. Useful outside `SelectionManager`
   * (which only ever tracks a single selected id, see this class's own doc
   * comment) for a caller that manages its own multi-target selection -
   * e.g. a "select N objects at once" perf comparison. Replaces whatever
   * `setSelected`/`setSelectedMany` set before it; `selected` only ever
   * reads back the first whole-object target, or the first instanced one if
   * there was no whole-object target.
   */
  setSelectedMany(
    targets: ToonOutlineTarget[]
  ): void {
    const { objects, instances } = splitTargets(targets);
    this.#selectedOutline.selectedObjects = objects;
    this.#selectedOutline.selectedInstances = instances;
  }

  get hovered(): ToonOutlineTarget | null {
    return this.#hoverOutline.selectedObjects[0] ?? this.#hoverOutline.selectedInstances[0] ?? null;
  }

  /**
   * Same as `setSelected`, for the dimmer "hover" outline.
   */
  setHovered(
    target: ToonOutlineTarget | null
  ): void {
    const { objects, instances } = target ? splitTargets([target]) : { objects: [], instances: [] };
    this.#hoverOutline.selectedObjects = objects;
    this.#hoverOutline.selectedInstances = instances;
  }

  /**
   * Mirrors `manager`'s selected/hovered ids onto `setSelected`/`setHovered`
   * live, including id resolution via `manager.targetFor` and suppressing
   * the hover outline while it matches the current selection - the same
   * behavior `SelectionManager`'s own per-object overlays already get, kept
   * consistent here even though this class sits outside that model (see
   * this class's own doc comment). Replaces any previous `sync` target.
   * Call `unsync` (or `dispose`) to stop mirroring.
   */
  sync(
    manager: SelectionManager
  ): void {
    this.unsync();
    this.#manager = manager;
    manager.addEventListener("selectionChange", this.#onSelectionChange);
    manager.addEventListener("hoverChange", this.#onHoverChange);
    this.#syncSelected();
    this.#syncHovered();
  }

  /**
   * Stops mirroring the manager passed to `sync`, if any - a no-op
   * otherwise. Leaves the outline pass's current selected/hovered objects in
   * place; call `setSelected(null)`/`setHovered(null)` to also clear them.
   */
  unsync(): void {
    if (!this.#manager) {
      return;
    }

    this.#manager.removeEventListener("selectionChange", this.#onSelectionChange);
    this.#manager.removeEventListener("hoverChange", this.#onHoverChange);
    this.#manager = null;
  }

  /**
   * Unsyncs (if synced) and frees the GPU resources owned by the outline
   * pipeline (render targets, materials).
   */
  dispose(): void {
    this.unsync();
    this.pipeline.dispose();
    this.#selectedOutline.dispose();
    this.#hoverOutline.dispose();
  }

  #syncSelected(): void {
    const manager = this.#manager;
    if (!manager) {
      return;
    }

    const id = manager.selected;
    this.setSelected(id ? (manager.targetFor(id) ?? null) : null);
  }

  #syncHovered(): void {
    const manager = this.#manager;
    if (!manager) {
      return;
    }

    const id = manager.hovered;
    // Selected already reads as outlined - no need for a dimmer hover
    // outline on top, same suppression SelectionManager's own overlays use.
    const suppressed = id !== null && id === manager.selected;
    this.setHovered(id !== null && !suppressed ? (manager.targetFor(id) ?? null) : null);
  }
}
