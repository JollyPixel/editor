// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { computeLocalBoundingBox } from "./computeLocalBoundingBox.ts";

// CONSTANTS
// Grows the box slightly so a group containing a single box-shaped mesh does
// not sit exactly on that mesh's own surface (same z-fighting concern as
// SelectionOutline's kScaleBias, applied to size instead of a scale bias).
const kSizeBias = 1.01;
// Draws after every default-renderOrder object, so an `xray` box reliably
// wins the pixel even though it skips the depth test - depth alone would
// only make it "win" against geometry rendered earlier in the same frame,
// not geometry drawn afterward.
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
   * Skips the depth test (and depth write) so the box stays visible through
   * any geometry in front of it, like an X-ray, instead of being occluded
   * like a normal object - handy for keeping a selection visible through
   * walls or a crowded scene. Still a single draw call either way, so this
   * doesn't cost anything extra to render.
   * @default false
   */
  xray?: boolean;
  /**
   * Opacity of a translucent fill mesh added alongside the line-segment box,
   * tinting the group's own volume in `color` instead of only outlining it.
   * `0` (the default) skips building the fill mesh entirely - the box stays
   * a pure wireframe, an extra draw call only a caller who wants it pays for.
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
   * Updates the fill mesh's own opacity - see `SelectionBoundingBoxOptions.fillOpacity`.
   * A no-op if this box was built with `fillOpacity: 0` (or omitted): there is
   * no fill mesh to update, and this method doesn't build one on demand -
   * whether a fill mesh exists at all is decided once, at construction.
   */
  setFillOpacity(
    opacity: number
  ): void {
    if (!this.#fillMesh) {
      return;
    }
    this.#fillMesh.material.opacity = opacity;
    this.#fillMesh.visible = opacity > 0;
  }

  /**
   * Toggles depth-test/write and render order between the normal and X-ray
   * behavior described on `SelectionBoundingBoxOptions.xray`. The fill mesh
   * (if any) follows the same depth-test toggle so it stays visible through
   * occluders alongside the wireframe - its own depth write stays permanently
   * off regardless (see `#createFillMesh`), so this only ever flips its
   * `depthTest`/render order.
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
   * Same unit `BoxGeometry(1, 1, 1)` the wireframe's own `EdgesGeometry` was
   * built from, so a fill mesh parented to `this` (inheriting its scale and
   * position for free, same as the wireframe inherits `target`'s own
   * transform) exactly fills the wireframe's silhouette without needing its
   * own separate sizing logic. `depthWrite` stays off unconditionally
   * (unlike the wireframe's own material, which flips it with `xray`) - a
   * translucent fill corrupting the depth buffer for whatever draws after it
   * is exactly the bug already fixed once this session in `ColoredOutlinePass`'s
   * own priority-mask material; nothing here needs the fill's own depth
   * written for any later pass to read, so there's no upside to risking it
   * again.
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
