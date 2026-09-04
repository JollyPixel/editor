// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { computeLocalBoundingBox } from "./computeLocalBoundingBox.ts";

// CONSTANTS
// Grows the box slightly so it doesn't sit exactly on a single box-shaped
// mesh's own surface (same z-fighting concern as SelectionOutline's offset).
const kSizeBias = 1.01;
// Draws after every default-renderOrder object, so an `xray` box wins the
// pixel even though it skips the depth test.
const kXrayRenderOrder = 999;

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
  /**
   * Skips the depth test/write so the box stays visible through other
   * geometry, like an X-ray. Still a single draw call, so this costs
   * nothing extra.
   * @default false
   */
  xray?: boolean;
  /**
   * Opacity of a translucent fill mesh alongside the line-segment box,
   * tinting the group's own volume in `color`. `0` (default) skips building
   * the fill mesh entirely.
   * @default 0
   */
  fillOpacity?: number;
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

  #fillMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> | null = null;

  constructor(
    options: SelectionBoundingBoxOptions
  ) {
    const {
      target, color = "#ffffff", opacity = 1, xray = false, fillOpacity = 0
    } = options;

    super(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthTest: !xray,
        depthWrite: !xray
      })
    );

    this.target = target;
    this.renderOrder = xray ? kXrayRenderOrder : 1;

    if (fillOpacity > 0) {
      this.#fillMesh = this.#createFillMesh(color, fillOpacity, xray);
      this.add(this.#fillMesh);
    }

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
    this.#fillMesh?.material.color.set(color);
  }

  setOpacity(
    opacity: number
  ): void {
    this.material.opacity = opacity;
    this.material.transparent = opacity < 1;
  }

  /**
   * Updates the fill mesh's opacity - see
   * `SelectionBoundingBoxOptions.fillOpacity`. Builds the fill mesh on
   * demand if none exists yet, matching the wireframe's current color/X-ray
   * state; a non-positive opacity on a box with no fill mesh is a no-op.
   */
  setFillOpacity(
    opacity: number
  ): void {
    if (!this.#fillMesh) {
      if (opacity <= 0) {
        return;
      }
      this.#fillMesh = this.#createFillMesh(this.material.color, opacity, !this.material.depthTest);
      this.add(this.#fillMesh);

      return;
    }
    this.#fillMesh.material.opacity = opacity;
    this.#fillMesh.visible = opacity > 0;
  }

  /**
   * Toggles depth-test/write and render order for X-ray - see
   * `SelectionBoundingBoxOptions.xray`. The fill mesh (if any) follows the
   * same depth-test toggle but keeps depth write permanently off (see
   * `#createFillMesh`).
   */
  setXray(
    xray: boolean
  ): void {
    this.material.depthTest = !xray;
    this.material.depthWrite = !xray;
    this.renderOrder = xray ? kXrayRenderOrder : 1;

    if (this.#fillMesh) {
      this.#fillMesh.material.depthTest = !xray;
      this.#fillMesh.renderOrder = xray ? kXrayRenderOrder : 1;
    }
  }

  dispose(): void {
    this.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();

    if (this.#fillMesh) {
      this.#fillMesh.geometry.dispose();
      this.#fillMesh.material.dispose();
      this.#fillMesh = null;
    }
  }

  /**
   * Same unit `BoxGeometry(1, 1, 1)` the wireframe's own `EdgesGeometry`
   * was built from, so a fill mesh parented to `this` exactly fills the
   * wireframe's silhouette with no separate sizing logic. `depthWrite`
   * stays off unconditionally, unlike the wireframe's own material - a
   * translucent fill writing depth would corrupt whatever draws after it,
   * and nothing here needs it read back.
   */
  #createFillMesh(
    color: THREE.ColorRepresentation,
    opacity: number,
    xray: boolean
  ): THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthTest: !xray,
        depthWrite: false
      })
    );
    mesh.renderOrder = xray ? kXrayRenderOrder : 1;

    return mesh;
  }
}
