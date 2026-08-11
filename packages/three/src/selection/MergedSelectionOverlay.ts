// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Import Internal Dependencies
import { buildHullGeometry, buildHighlightMaterial, createXrayUniform } from "./SelectionHighlight.ts";

// CONSTANTS
// Same value/rationale as `SelectionOutline`'s and `SelectionHighlight`'s own
// `kXrayRenderOrder` - duplicated locally rather than shared, matching how
// those two classes each already keep their own copy.
const kXrayRenderOrder = 999;

export type MergedSelectionOverlayStyle = "outline" | "highlight";

export interface MergedSelectionOverlayOptions {
  /**
   * Object every merged vertex is added to - not any single `target`, since
   * the baked geometry below already carries every target's own current
   * world transform.
   */
  parent: THREE.Object3D;
  style: MergedSelectionOverlayStyle;
  /**
   * Meshes to merge into one overlay. Must be non-empty - construct nothing
   * (and skip this class entirely) for an empty selection, the same
   * convention `createSelectionOverlay`'s own callers already follow.
   *
   * For `"highlight"`, every target's geometry must agree on whether it's
   * indexed (true for `THREE.TorusKnotGeometry` and effectively every three
   * primitive) - `mergeGeometries` requires consistent attributes/indexing
   * across its inputs, same as `"outline"`'s `THREE.EdgesGeometry` output,
   * which is always non-indexed regardless of the source, so it never hits
   * this constraint.
   */
  targets: THREE.Mesh[];
  color: THREE.ColorRepresentation;
  opacity?: number;
  /**
   * Forwarded to the merged `THREE.LineBasicMaterial` when `style` is
   * `"outline"` - ignored otherwise. See `SelectionOutlineOptions.linewidth`'s
   * own doc comment for the same platform-clamping caveat.
   */
  linewidth?: number;
  /**
   * Forwarded to `buildHullGeometry` when `style` is `"highlight"` - ignored
   * otherwise. See `SelectionHighlightOptions.thickness`'s own doc comment.
   */
  thickness?: number;
  xray?: boolean;
}

/**
 * One shared `THREE.LineSegments`/`THREE.Mesh` covering many targets at
 * once - a single draw call regardless of how many targets it covers,
 * unlike building one `SelectionOutline`/`SelectionHighlight` per target via
 * `createSelectionOverlay` (one draw call *each*). Built for bulk multi-select
 * scenarios outside `SelectionManager`'s own single-selection model (its own
 * overlay never covers more than two targets - selected and hover - so it has
 * nothing to gain here); see `packages/three/examples/scripts/demo-stress.ts`'s
 * "Random Selection" for the motivating case.
 *
 * Each target's own `EdgesGeometry`/hull geometry is baked into world space
 * (`geometry.applyMatrix4(target.matrixWorld)`) before merging via
 * `BufferGeometryUtils.mergeGeometries`, then added to `parent` at that
 * parent's own origin - unlike `SelectionOutline`/`SelectionHighlight`, which
 * stay in the target's local space and inherit its transform for free by
 * being parented as its child. That tradeoff is exactly what makes the merge
 * possible (one shared geometry can't simultaneously sit in N different local
 * spaces) and exactly why this is a static, one-shot bake rather than a live
 * overlay: it does not follow a target that moves afterward, and covers
 * whatever `targets` was at construction time only. Dispose and reconstruct
 * whenever the covered set (or any covered target's transform) changes -
 * the same rebuild-on-change pattern `createSelectionOverlay`'s own callers
 * already use for their per-target overlays.
 *
 * Not applicable to the `"toonOutline"` mesh style - that one already costs
 * nothing extra per target (`ToonOutlinePass.setSelectedMany` takes the whole
 * batch directly, see its own doc comment), so there is no per-target draw
 * call here to merge away.
 */
export class MergedSelectionOverlay {
  readonly object:
    THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> |
    THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicNodeMaterial>;

  constructor(
    options: MergedSelectionOverlayOptions
  ) {
    const { parent, style, targets, color, opacity = 1, linewidth = 1, thickness, xray = false } = options;

    this.object = style === "highlight" ?
      buildMergedHighlight(targets, { color, opacity, thickness, xray }) :
      buildMergedOutline(targets, { color, opacity, linewidth, xray });

    this.object.renderOrder = xray ? kXrayRenderOrder : 1;
    parent.add(this.object);
  }

  dispose(): void {
    this.object.removeFromParent();
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}

interface BuildMergedOutlineOptions {
  color: THREE.ColorRepresentation;
  opacity: number;
  linewidth: number;
  xray: boolean;
}

function buildMergedOutline(
  targets: THREE.Mesh[],
  options: BuildMergedOutlineOptions
): THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const { color, opacity, linewidth, xray } = options;

  const merged = mergeWorldGeometries(targets, (target) => new THREE.EdgesGeometry(target.geometry));

  return new THREE.LineSegments(
    merged,
    new THREE.LineBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      linewidth,
      depthTest: !xray,
      depthWrite: !xray
    })
  );
}

interface BuildMergedHighlightOptions {
  color: THREE.ColorRepresentation;
  opacity: number;
  thickness: number | undefined;
  xray: boolean;
}

function buildMergedHighlight(
  targets: THREE.Mesh[],
  options: BuildMergedHighlightOptions
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicNodeMaterial> {
  const { color, opacity, thickness, xray } = options;

  const merged = mergeWorldGeometries(targets, (target) => buildHullGeometry(target.geometry, thickness));
  const xrayUniform = createXrayUniform(xray);
  const material = buildHighlightMaterial({ color, opacity, xray, xrayUniform });

  return new THREE.Mesh(merged, material);
}

/**
 * Builds one geometry per target via `perTarget`, bakes each into world
 * space, merges them into one, then disposes the per-target intermediates -
 * only the merged result survives.
 */
function mergeWorldGeometries(
  targets: THREE.Mesh[],
  perTarget: (target: THREE.Mesh) => THREE.BufferGeometry
): THREE.BufferGeometry {
  const geometries = targets.map((target) => {
    target.updateWorldMatrix(true, false);
    const geometry = perTarget(target);
    geometry.applyMatrix4(target.matrixWorld);

    return geometry;
  });

  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) {
    geometry.dispose();
  }

  return merged;
}
