// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
// Grows the box slightly so a group containing a single box-shaped mesh does
// not sit exactly on that mesh's own surface (same z-fighting concern as
// SelectionOutline's kScaleBias, applied to size instead of a scale bias).
const kSizeBias = 1.01;

export interface SelectionBoundingBoxOptions {
  /**
   * Group being outlined. The box is added as a child of `target`, so it
   * inherits its transform for free and is automatically removed if `target`
   * itself is later removed from the scene.
   */
  target: THREE.Object3D;
  /**
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Material opacity. Lets a dimmer "hover" box and a full "selected" box
   * share the same class without a second visual language.
   * @default 1
   */
  opacity?: number;
}

/**
 * Non-destructive bounding-box overlay for a group of meshes, built from the
 * local-space union of every mesh descendant's own bounding box and added as
 * a child of `target` - it inherits the group's rotation for free instead of
 * drawing a world-space axis-aligned box that would look loose once the
 * group is rotated.
 */
export class SelectionBoundingBox extends THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  readonly target: THREE.Object3D;

  constructor(
    options: SelectionBoundingBoxOptions
  ) {
    const { target, color = "#ffffff", opacity = 1 } = options;

    super(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity
      })
    );

    this.target = target;
    this.renderOrder = 1;
    target.add(this);
    this.update();
  }

  /**
   * Recomputes the box from the target's current mesh descendants. Call this
   * after adding/removing children or after a descendant's own geometry
   * changes - like SelectionOutline, live changes are not tracked automatically.
   */
  update(): void {
    const box = computeLocalBoundingBox(this.target);

    this.visible = !box.isEmpty();
    if (!this.visible) {
      return;
    }

    const size = box.getSize(new THREE.Vector3()).multiplyScalar(kSizeBias);
    const center = box.getCenter(new THREE.Vector3());

    this.position.copy(center);
    this.scale.copy(size);
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

/**
 * Union of every mesh descendant's bounding box, expressed in `target`'s own
 * local space (i.e. as if `target` had an identity transform) so the result
 * can be applied as this overlay's position/scale once it is parented to
 * `target`.
 */
function computeLocalBoundingBox(
  target: THREE.Object3D
): THREE.Box3 {
  target.updateWorldMatrix(true, true);
  const inverseTargetWorld = target.matrixWorld.clone().invert();
  const relativeMatrix = new THREE.Matrix4();
  const meshLocalBox = new THREE.Box3();
  const box = new THREE.Box3();

  target.traverse((descendant) => {
    if (!(descendant instanceof THREE.Mesh)) {
      return;
    }

    descendant.geometry.computeBoundingBox();
    if (!descendant.geometry.boundingBox) {
      return;
    }

    relativeMatrix.multiplyMatrices(inverseTargetWorld, descendant.matrixWorld);
    meshLocalBox.copy(descendant.geometry.boundingBox).applyMatrix4(relativeMatrix);
    box.union(meshLocalBox);
  });

  return box;
}
