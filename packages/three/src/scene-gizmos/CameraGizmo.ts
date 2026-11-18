// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  frustumLinePoints,
  type FrustumLens
} from "../common/geometry/frustumLines.ts";
import { HaloLines } from "../common/lines/HaloLines.ts";
import {
  GIZMO_SELECTED_COLOR,
  GizmoIcon
} from "./GizmoIcon.ts";

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
const kDefaultAspect = 16 / 9;
const kDefaultDepth = 3;
const kScale = new THREE.Vector3();

export class CameraGizmo extends THREE.Group {
  readonly #aspect: number;
  readonly #depth: number;
  readonly #color: THREE.Color;
  readonly #selectedColor: THREE.Color;
  readonly #icon: GizmoIcon;
  readonly #frustum: HaloLines;
  #lensKey = "";

  constructor(
    options: CameraGizmoOptions = {}
  ) {
    super();
    const {
      color = kDefaultColor,
      selectedColor = GIZMO_SELECTED_COLOR,
      aspect = kDefaultAspect,
      depth = kDefaultDepth
    } = options;

    this.#aspect = aspect;
    this.#depth = depth;
    this.#color = new THREE.Color(color);
    this.#selectedColor = new THREE.Color(selectedColor);
    this.#icon = new GizmoIcon("camera", selectedColor);
    this.#frustum = new HaloLines(color);
    this.add(this.#frustum, this.#icon);
  }

  get selected(): boolean {
    return this.#icon.selected;
  }

  set selected(
    selected: boolean
  ) {
    this.#icon.selected = selected;
    this.#frustum.paint(selected ? this.#selectedColor : this.#color);
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
      this.#frustum.redraw(
        frustumLinePoints(this.#frustumLens(lens, far), {
          apex: true,
          up: true
        })
      );
    }

    matrixWorld.decompose(this.position, this.quaternion, kScale);
  }

  override dispose(): void {
    this.#frustum.dispose();
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
