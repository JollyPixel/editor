// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  frustumLinePoints,
  type FrustumLens
} from "../common/geometry/frustumLines.ts";
import { GizmoIcon } from "./GizmoIcon.ts";

export interface CameraGizmoLens {
  projection: "perspective" | "orthographic";
  /**
   * Vertical field of view, in degrees.
   */
  fov: number;
  near: number;
  far: number;
  /**
   * Height of the orthographic view, in world units.
   */
  orthographicScale: number;
}

export interface CameraGizmoOptions {
  /**
   * @default "#aab4c3"
   */
  color?: THREE.ColorRepresentation;
  /**
   * @default "#f5c46b"
   */
  selectedColor?: THREE.ColorRepresentation;
  /**
   * Width-to-height ratio of the drawn frustum.
   * @default 16 / 9
   */
  aspect?: number;
  /**
   * Longest drawn distance past `near`, in world units.
   * @default 3
   */
  depth?: number;
}

// CONSTANTS
const kDefaultColor = "#aab4c3";
const kDefaultSelectedColor = "#f5c46b";
const kDefaultAspect = 16 / 9;
const kDefaultDepth = 3;
const kIdleIconColor = "#ffffff";
const kScale = new THREE.Vector3();

export class CameraGizmo extends THREE.Group {
  readonly #aspect: number;
  readonly #depth: number;
  readonly #color: THREE.Color;
  readonly #selectedColor: THREE.Color;
  readonly #icon = new GizmoIcon("camera");
  readonly #frustum: THREE.LineSegments<
    THREE.BufferGeometry, THREE.LineBasicMaterial
  >;
  #lensKey = "";
  #selected = false;

  constructor(
    options: CameraGizmoOptions = {}
  ) {
    super();
    const {
      color = kDefaultColor,
      selectedColor = kDefaultSelectedColor,
      aspect = kDefaultAspect,
      depth = kDefaultDepth
    } = options;

    this.#aspect = aspect;
    this.#depth = depth;
    this.#color = new THREE.Color(color);
    this.#selectedColor = new THREE.Color(selectedColor);
    this.#frustum = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color })
    );
    this.#icon.color = kIdleIconColor;
    this.add(this.#frustum, this.#icon);
  }

  get selected(): boolean {
    return this.#selected;
  }

  set selected(
    selected: boolean
  ) {
    this.#selected = selected;
    this.#frustum.material.color.copy(
      selected ? this.#selectedColor : this.#color
    );
    this.#icon.color = selected ? this.#selectedColor : kIdleIconColor;
  }

  update(
    lens: CameraGizmoLens,
    matrixWorld: THREE.Matrix4
  ): void {
    const far = Math.min(lens.far, lens.near + this.#depth);
    const key = [
      lens.projection,
      lens.fov,
      lens.orthographicScale,
      lens.near,
      far
    ].join(":");
    if (key !== this.#lensKey) {
      this.#lensKey = key;
      this.#frustum.geometry.dispose();
      this.#frustum.geometry = new THREE.BufferGeometry().setFromPoints(
        frustumLinePoints(this.#frustumLens(lens, far), {
          apex: true,
          up: true
        })
      );
    }

    matrixWorld.decompose(this.position, this.quaternion, kScale);
  }

  override dispose(): void {
    this.#frustum.geometry.dispose();
    this.#frustum.material.dispose();
    this.#icon.dispose();
  }

  #frustumLens(
    lens: CameraGizmoLens,
    far: number
  ): FrustumLens {
    const { near } = lens;

    if (lens.projection === "orthographic") {
      return {
        projection: "orthographic",
        height: lens.orthographicScale,
        aspect: this.#aspect,
        near,
        far
      };
    }

    return {
      projection: "perspective",
      fov: lens.fov,
      aspect: this.#aspect,
      near,
      far
    };
  }
}
