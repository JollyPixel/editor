// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// CONSTANTS
const kXrayRenderOrder = 999;

export interface MergedSelectionOverlayOptions {
  /**
   * Parent for the world-space merged geometry.
   */
  parent: THREE.Object3D;
  /**
   * Must contain at least one mesh.
   */
  targets: THREE.Mesh[];
  color: THREE.ColorRepresentation;
  opacity?: number;
  /**
   * Line width. Most WebGL backends clamp it to `1`.
   */
  linewidth?: number;
  xray?: boolean;
}

/**
 * Merges target edges into one world-space draw call.
 * Rebuild it after target sets or transforms change.
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

  const merged = mergeWorldGeometries(
    targets,
    (target) => new THREE.EdgesGeometry(target.geometry)
  );

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
