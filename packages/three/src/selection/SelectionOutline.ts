// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
// Edges sit exactly on the target's own surface, so identical depth values
// z-fight with the mesh's triangles at that seam (visible as a dashed/flickering
// line). `glPolygonOffset` doesn't apply to GL_LINES, so nudge the outline
// slightly outward via scale instead - imperceptible as a size change, enough
// to win the depth test outright.
const kScaleBias = 1.005;

export interface SelectionOutlineOptions {
  /**
   * Mesh being outlined. The outline is added as a child of `target`, so it
   * inherits its transform for free and is automatically removed if `target`
   * itself is later removed from the scene.
   */
  target: THREE.Mesh;
  /**
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Material opacity. Lets a dimmer "hover" outline and a full "selected"
   * outline share the same class without a second visual language.
   * @default 1
   */
  opacity?: number;
}

/**
 * Non-destructive outline overlay for a single mesh, built once from
 * `target.geometry` via `THREE.EdgesGeometry` and added as a child of
 * `target` - never mutates the target's own material. Several instances can
 * coexist on the same target (e.g. one per peer that has it selected)
 * without conflicting, unlike recoloring the mesh's own material in place.
 */
export class SelectionOutline extends THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  constructor(
    options: SelectionOutlineOptions
  ) {
    const { target, color = "#ffffff", opacity = 1 } = options;

    super(
      new THREE.EdgesGeometry(target.geometry),
      new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity
      })
    );

    this.renderOrder = 1;
    this.scale.setScalar(kScaleBias);
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
    this.material.transparent = opacity < 1;
  }

  dispose(): void {
    this.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
