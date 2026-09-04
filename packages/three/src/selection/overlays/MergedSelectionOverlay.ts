// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// CONSTANTS
// Same value/rationale as `SelectionOutline`'s own `kXrayRenderOrder`,
// duplicated locally.
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
   * Forwarded to the merged `THREE.LineBasicMaterial` - same platform
   * clamping caveat as `SelectionOutlineOptions.linewidth`.
   */
  linewidth?: number;
  xray?: boolean;
}

/**
 * One shared `THREE.LineSegments` covering many targets at once - a single
 * draw call regardless of target count, unlike building one
 * `SelectionOutline` per target (one draw call each). Built for bulk
 * multi-select scenarios outside `SelectionManager`'s own single-selection
 * model; see `examples/scripts/selection-stress.ts`'s "Random Selection".
 *
 * Each target's `EdgesGeometry` is baked into world space before merging,
 * then added to `parent` at its own origin - a static, one-shot snapshot of
 * `targets` at construction time, not a live overlay. Dispose and
 * reconstruct whenever the covered set or any target's transform changes.
 *
 * Not applicable to the `"highlight"` technique, which already batches
 * every target in one pass (`HighlightPass.setEntries`) with nothing
 * per-target to merge away.
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
