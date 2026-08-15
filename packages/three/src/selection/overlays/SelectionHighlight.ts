// Import Third-party Dependencies
import * as THREE from "three";
import {
  Fn,
  uniform,
  dot,
  abs,
  oneMinus,
  saturate,
  pow,
  mix,
  positionViewDirection,
  normalView,
  If,
  Discard
} from "three/tsl";
import { MeshBasicNodeMaterial } from "three/webgpu";

// CONSTANTS
// Rim thickness, expressed as a fraction of the target's own bounding-sphere
// radius rather than a fixed world-space distance, so it stays proportionally
// thin/thick regardless of the mesh's actual size. Too small and it
// z-fights/disappears, too large and the rim reads as a bulky halo instead of
// a thin line.
const kHullBiasRatio = 0.03;
// Draws after every default-renderOrder object, so an `xray` hull reliably
// wins the pixel even though it skips the depth test - depth alone would
// only make it "win" against geometry rendered earlier in the same frame,
// not geometry drawn afterward.
const kXrayRenderOrder = 999;
// Shapes how fast xray mode fades from the grazing-angle rim toward the
// face-on "interior" - see the `opacityNode` comment in `buildHighlightMaterial`
// for why this fade exists at all. Higher narrows the rim, lower widens it.
const kXrayFresnelPower = 8;
// Below this, a fragment's alpha contributes nothing visible - discarding it
// skips blending entirely. Matters because xray mode still rasterizes the
// *entire* silhouette (not just a thin line), so most of its area needs to be
// cheaply thrown away rather than blended at near-zero opacity.
const kXrayDiscardThreshold = 0.003;

export interface SelectionHighlightOptions {
  /**
   * Mesh being highlighted. The hull is added as a child of `target`, so it
   * inherits its transform for free and is automatically removed if `target`
   * itself is later removed from the scene.
   */
  target: THREE.Mesh;
  /**
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Material opacity. Lets a dimmer "hover" highlight and a full "selected"
   * highlight share the same class without a second visual language.
   * @default 1
   */
  opacity?: number;
  /**
   * Skips the depth test (and depth write) so the rim stays visible through
   * any geometry in front of it, like an X-ray, instead of being occluded
   * like a normal object - handy for keeping a selection visible through
   * walls or a crowded scene. Also fades the hull's opacity by view angle
   * (a Fresnel term) so only the true grazing-angle rim stays visible -
   * without this, disabling the depth test alone would reveal the *entire*
   * solid hull, not just the thin rim (see this class's own doc comment for
   * why). Still a single draw call either way, so this doesn't cost anything
   * extra to render.
   * @default false
   */
  xray?: boolean;
  /**
   * Rim thickness, expressed as a fraction of the target's own
   * bounding-sphere radius rather than a fixed world-space distance - see
   * `kHullBiasRatio`'s own comment for why a ratio instead of a fixed
   * distance. Too small and the rim z-fights/disappears, too large and it
   * reads as a bulky halo instead of a thin line.
   * @default 0.03
   */
  thickness?: number;
}

/**
 * Non-destructive inverted-hull silhouette overlay for a single mesh: a
 * standalone copy of `target.geometry` with every vertex pushed outward
 * along a normal, rendered back-face-only so only a thin rim pokes out
 * around its silhouette from any viewing angle.
 *
 * Unlike `SelectionOutline`, this doesn't depend on edge angles, so it reads
 * as a clean rim on smooth/high-poly meshes (a torus knot, a sculpted
 * import) where `THREE.EdgesGeometry` would draw far too many "hard" edges
 * and look like a wireframe soup instead.
 *
 * Extrudes along vertex normals rather than uniformly scaling the whole mesh
 * from its local origin - a uniform scale only pushes the surface outward
 * correctly for roughly convex, origin-centered shapes, so it thins out or
 * inverts on concave geometry (a torus's inner hole, a torus knot's own
 * self-wrapping tube), leaving visible gaps in the rim there. The normal
 * used per vertex is averaged across every vertex sharing that exact
 * position rather than each vertex's own (possibly duplicated) normal -
 * a hard-edged mesh (a box, a low-poly primitive) duplicates a vertex once
 * per adjacent face, each copy carrying that face's own flat normal, so
 * extruding each copy along its own normal would pull the shared
 * edges/corners apart into a "disconnected per face" look instead of a
 * single connected hull. The extrusion is computed once on the CPU into a
 * plain position buffer rather than via a vertex shader patch, so it renders
 * identically under `WebGLRenderer` and `WebGPURenderer` - a shader-based
 * approach (e.g. `onBeforeCompile`) is a classic-GLSL hook that
 * `WebGPURenderer`'s node-material pipeline silently ignores, which would
 * leave the hull sitting exactly on the target's own surface and entirely
 * depth-occluded by it.
 *
 * @note
 * The hull's own material is a TSL `MeshBasicNodeMaterial` and requires
 * `THREE.WebGPURenderer`, unlike `SelectionOutline`/`SelectionBoundingBox`
 * which stay on classic materials - see `buildHighlightMaterial`'s own
 * comment for why `xray` needs this.
 */
export class SelectionHighlight extends THREE.Mesh<THREE.BufferGeometry, MeshBasicNodeMaterial> {
  #target: THREE.Mesh;
  #xrayUniform: ReturnType<typeof createXrayUniform>;

  constructor(
    options: SelectionHighlightOptions
  ) {
    const { target, color = "#ffffff", opacity = 1, xray = false, thickness = kHullBiasRatio } = options;

    const xrayUniform = createXrayUniform(xray);

    super(
      buildHullGeometry(target.geometry, thickness),
      buildHighlightMaterial({ color, opacity, xray, xrayUniform })
    );

    this.#target = target;
    this.#xrayUniform = xrayUniform;
    this.renderOrder = xray ? kXrayRenderOrder : 1;
    target.add(this);
  }

  setColor(
    color: THREE.ColorRepresentation
  ): void {
    this.material.color.set(color);
  }

  setOpacity(
    opacity: number
  ): void {
    this.material.opacity = opacity;
    this.material.transparent = opacity < 1 || this.#xrayUniform.value === 1;
  }

  /**
   * Rebuilds the hull geometry at the given `thickness` (see this option's
   * own doc comment on `SelectionHighlightOptions`), disposing the previous
   * one - unlike `setColor`/`setOpacity`, thickness is baked into the
   * geometry's positions rather than read from the material each frame, so
   * changing it can't be a cheap in-place update.
   */
  setThickness(
    thickness: number
  ): void {
    const previousGeometry = this.geometry;
    this.geometry = buildHullGeometry(this.#target.geometry, thickness);
    previousGeometry.dispose();
  }

  /**
   * Toggles depth-test/write, render order, and the Fresnel opacity fade
   * between the normal and X-ray behavior described on
   * `SelectionHighlightOptions.xray`. Cheap - only flips a uniform and a few
   * material flags, no geometry rebuild.
   */
  setXray(
    xray: boolean
  ): void {
    this.#xrayUniform.value = xray ? 1 : 0;
    this.material.depthTest = !xray;
    this.material.depthWrite = !xray;
    this.material.transparent = xray || this.material.opacity < 1;
    this.renderOrder = xray ? kXrayRenderOrder : 1;
  }

  /**
   * Disposes both its own geometry (the extruded copy built at construction,
   * not `target`'s own) and its material.
   */
  dispose(): void {
    this.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * Exported alongside `buildHighlightMaterial` - `MergedSelectionOverlay`
 * needs to build this uniform itself to pass into that function.
 */
export function createXrayUniform(
  xray: boolean
) {
  return uniform(xray ? 1 : 0, "float");
}

interface BuildHighlightMaterialOptions {
  color: THREE.ColorRepresentation;
  opacity: number;
  xray: boolean;
  xrayUniform: ReturnType<typeof createXrayUniform>;
}

/**
 * Builds the hull's material. `color`/`opacity`/`transparent`/`depthTest`/
 * `depthWrite` stay classic `Material` properties (unaffected by TSL, so
 * `setColor`/`setOpacity` don't need to touch a node graph) - only the extra
 * X-ray opacity fade needs a node, via `opacityNode`.
 *
 * Without this fade, disabling the depth test for `xray` would reveal the
 * hull's *entire* back-face fill: the thin rim `xray: false` shows is only a
 * side effect of the target's own front faces occluding the rest of the
 * hull, and disabling the depth test removes that occlusion entirely, not
 * just the part hiding it from external geometry. `opacityNode` fades each
 * fragment by how grazing its view angle is (a Fresnel term) so the "interior"
 * of the hull - the part that used to be hidden by the target's own
 * occlusion - fades out on its own regardless of depth testing, leaving only
 * the true silhouette-adjacent rim visible. `xrayUniform` blends this fade in
 * (1) or out (0) live, from `SelectionHighlight.setXray`, without needing a
 * different material or a shader recompile.
 */
/**
 * Exported (like `buildHullGeometry` below) so `MergedSelectionOverlay` can
 * build one shared material for many merged hulls instead of duplicating
 * this node graph per target - see that class's own doc comment.
 */
export function buildHighlightMaterial(
  options: BuildHighlightMaterialOptions
): MeshBasicNodeMaterial {
  const { color, opacity, xray, xrayUniform } = options;

  const material = new MeshBasicNodeMaterial();
  material.color.set(color);
  material.side = THREE.BackSide;
  material.opacity = opacity;
  material.transparent = opacity < 1 || xray;
  material.depthTest = !xray;
  material.depthWrite = !xray;

  material.opacityNode = Fn(() => {
    const grazing = oneMinus(saturate(abs(dot(positionViewDirection, normalView))));
    const fresnel = pow(grazing, kXrayFresnelPower);
    const factor = mix(1, fresnel, xrayUniform);

    If(factor.lessThan(kXrayDiscardThreshold), () => {
      Discard();
    });

    return factor;
  })();

  return material;
}

/**
 * Builds a standalone geometry sharing `geometry`'s index but with a fresh
 * position buffer, each vertex pushed outward by `biasRatio` of
 * `geometry`'s bounding-sphere radius along the position-averaged normal
 * from `averagedNormalsByPosition` (not the vertex's own normal - see this
 * class's own doc comment for why). Falls back to computing vertex normals
 * first if `geometry` doesn't already have them.
 */
/**
 * Exported so `MergedSelectionOverlay` can build each target's own hull
 * geometry before merging them into one draw call - see that class's own
 * doc comment for why a per-target `SelectionHighlight` doesn't scale there.
 */
export function buildHullGeometry(
  geometry: THREE.BufferGeometry,
  biasRatio: number = kHullBiasRatio
): THREE.BufferGeometry {
  if (!geometry.getAttribute("normal")) {
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingSphere();

  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const bias = (geometry.boundingSphere?.radius ?? 1) * biasRatio;
  const smoothNormals = averagedNormalsByPosition(position, normal);

  const extrudedPosition = new Float32Array(position.count * 3);
  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    vertex.addScaledVector(smoothNormals[i], bias);
    vertex.toArray(extrudedPosition, i * 3);
  }

  const hullGeometry = new THREE.BufferGeometry();
  hullGeometry.setAttribute("position", new THREE.BufferAttribute(extrudedPosition, 3));
  if (geometry.index) {
    // Cloned, not shared: `dispose()` frees this geometry's own index buffer
    // independently, so it can't take down the target's (or another peer's
    // overlay's) GPU index buffer out from under it.
    hullGeometry.setIndex(geometry.index.clone());
  }

  return hullGeometry;
}

/**
 * One averaged, unit-length normal per vertex in `position`: every vertex
 * exactly coincident with another (e.g. a hard-edged mesh's per-face
 * duplicated corner vertices) gets the sum of their normals instead of its
 * own, so they extrude to the exact same point rather than pulling apart.
 * Vertices with no coincident twin are unaffected - their "averaged" normal
 * is just their own. A smooth mesh (no duplicated positions) is unaffected
 * either way.
 */
function averagedNormalsByPosition(
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  normal: THREE.BufferAttribute | THREE.InterleavedBufferAttribute
): THREE.Vector3[] {
  const indicesByPosition = new Map<string, number[]>();
  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const key = `${vertex.x.toFixed(5)},${vertex.y.toFixed(5)},${vertex.z.toFixed(5)}`;

    const indices = indicesByPosition.get(key);
    if (indices) {
      indices.push(i);
    }
    else {
      indicesByPosition.set(key, [i]);
    }
  }

  const averaged = new Array<THREE.Vector3>(position.count);
  const sum = new THREE.Vector3();
  const single = new THREE.Vector3();

  for (const indices of indicesByPosition.values()) {
    sum.set(0, 0, 0);
    for (const i of indices) {
      sum.add(single.fromBufferAttribute(normal, i));
    }
    sum.normalize();

    for (const i of indices) {
      averaged[i] = sum.clone();
    }
  }

  return averaged;
}
