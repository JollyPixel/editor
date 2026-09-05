// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { computeLocalBoundingBox } from "./computeLocalBoundingBox.ts";

// CONSTANTS
const kSizeBias = 1.01;
const kXrayRenderOrder = 999;

export interface SelectionBoundingBoxOptions {
  /**
   * Group to outline. The overlay is attached to it.
   */
  target: THREE.Object3D;
  /**
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Line opacity.
   * @default 1
   */
  opacity?: number;
  /**
   * Draws the box through other geometry.
   * @default false
   */
  xray?: boolean;
  /**
   * Fill opacity. `0` omits the fill mesh.
   * @default 0
   */
  fillOpacity?: number;
}

/**
 * Draws the local bounds of a target's mesh descendants.
 */
export class SelectionBoundingBox extends THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  readonly target: THREE.Object3D;

  #fillMesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> | null = null;

  constructor(
    options: SelectionBoundingBoxOptions
  ) {
    const {
      target,
      color = "#ffffff",
      opacity = 1,
      xray = false,
      fillOpacity = 0
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

  update(): void {
    const box = computeLocalBoundingBox(this.target);

    this.visible = !box.isEmpty();
    if (!this.visible) {
      return;
    }

    const size = box.getSize(
      new THREE.Vector3()
    ).multiplyScalar(kSizeBias);
    const center = box.getCenter(
      new THREE.Vector3()
    );

    this.position.copy(center);
    this.scale.copy(size);
  }

  get color(): THREE.Color {
    return this.material.color.clone();
  }

  set color(
    color: THREE.ColorRepresentation
  ) {
    this.material.color.set(color);
    this.#fillMesh?.material.color.set(color);
  }

  get opacity(): number {
    return this.material.opacity;
  }

  set opacity(
    opacity: number
  ) {
    this.material.opacity = opacity;
    this.material.transparent = opacity < 1;
  }

  get fillOpacity(): number {
    return this.#fillMesh?.material.opacity ?? 0;
  }

  set fillOpacity(
    opacity: number
  ) {
    if (!this.#fillMesh) {
      if (opacity <= 0) {
        return;
      }
      this.#fillMesh = this.#createFillMesh(
        this.material.color,
        opacity,
        !this.material.depthTest
      );
      this.add(this.#fillMesh);

      return;
    }
    this.#fillMesh.material.opacity = opacity;
    this.#fillMesh.visible = opacity > 0;
  }

  get xray(): boolean {
    return !this.material.depthTest;
  }

  set xray(
    xray: boolean
  ) {
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
