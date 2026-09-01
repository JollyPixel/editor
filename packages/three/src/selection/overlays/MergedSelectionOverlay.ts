// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// CONSTANTS
// Same value/rationale as `SelectionOutline`'s own `kXrayRenderOrder` -
// duplicated locally rather than shared, matching how that class keeps its
// own copy.
const kXrayRenderOrder = 999;

export interface MergedSelectionOverlayOptions {
  /**
   * Object every merged vertex is added to - not any single `target`, since
   * the baked geometry below already carries every target's own current
   * world transform.
   */
  parent: THREE.Object3D;
  /**
   * Meshes to merge into one overlay. Must be non-empty - construct nothing
   * (and skip this class entirely) for an empty selection, the same
   * convention `createSelectionOverlay`'s own callers already follow.
   */
  targets: THREE.Mesh[];
  color: THREE.ColorRepresentation;
  opacity?: number;
  /**
   * Forwarded to the merged `THREE.LineBasicMaterial`. See
   * `SelectionOutlineOptions.linewidth`'s own doc comment for the same
   * platform-clamping caveat.
   */
  linewidth?: number;
  xray?: boolean;
}

/**
 * One shared `THREE.LineSegments` covering many targets at once - a single
 * draw call regardless of how many targets it covers, unlike building one
 * `SelectionOutline` per target via `createSelectionOverlay` (one draw call
 * *each*). Built for bulk multi-select scenarios outside `SelectionManager`'s
 * own single-selection model (its own overlay never covers more than two
 * targets - selected and hover - so it has nothing to gain here); see
 * `packages/three/examples/scripts/selection-stress.ts`'s "Random Selection" for
 * the motivating case.
 *
 * Each target's own `EdgesGeometry` is baked into world space
 * (`geometry.applyMatrix4(target.matrixWorld)`) before merging via
 * `BufferGeometryUtils.mergeGeometries`, then added to `parent` at that
 * parent's own origin - unlike `SelectionOutline`, which stays in the
 * target's local space and inherits its transform for free by being parented
 * as its child. That tradeoff is exactly what makes the merge possible (one
 * shared geometry can't simultaneously sit in N different local spaces) and
 * exactly why this is a static, one-shot bake rather than a live overlay: it
 * does not follow a target that moves afterward, and covers whatever
 * `targets` was at construction time only. Dispose and reconstruct whenever
 * the covered set (or any covered target's transform) changes - the same
 * rebuild-on-change pattern `createSelectionOverlay`'s own callers already
 * use for their per-target overlays.
 *
 * Not applicable to the `"highlight"` technique - that one already costs
 * nothing extra per target (`HighlightPass.setEntries` takes the whole
 * batch directly), so there is no per-target draw call here to merge away.
 */
export class MergedSelectionOverlay {
  readonly object: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;

  constructor(
    options: MergedSelectionOverlayOptions
  ) {
    const { parent, targets, color, opacity = 1, linewidth = 1, xray = false } = options;

    this.object = buildMergedOutline(targets, { color, opacity, linewidth, xray });

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
