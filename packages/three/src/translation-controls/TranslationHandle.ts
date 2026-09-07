// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { createTranslationOutline } from "./outline.ts";
import type {
  TranslationAxis,
  TranslationDirection,
  TranslationOutlineOptions
} from "./types.ts";

export type TranslationHandleState = "idle" | "hovered" | "active";

export interface TranslationHandleOptions {
  axis: TranslationAxis;
  direction: TranslationDirection;
  geometry: THREE.BufferGeometry;
  length: number;
  color: THREE.ColorRepresentation;
  hoverColor: THREE.ColorRepresentation;
  activeColor: THREE.ColorRepresentation;
  outline: false | Required<TranslationOutlineOptions>;
  pickerRadius: number;
  pickerLengthScale: number;
  depthTest: boolean;
  renderOrder: number;
}

/**
 * Visual and picking geometry for one axis direction.
 */
export class TranslationHandle extends THREE.Object3D {
  override readonly type = "TranslationHandle";

  readonly axis: TranslationAxis;
  readonly direction: TranslationDirection;
  readonly picker: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;

  #visual: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  #outline: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null;
  #color: THREE.Color;
  #hoverColor: THREE.Color;
  #activeColor: THREE.Color;
  #state: TranslationHandleState = "idle";
  #disposed = false;

  constructor(
    options: TranslationHandleOptions
  ) {
    super();

    const {
      axis,
      direction,
      geometry,
      length,
      color,
      hoverColor,
      activeColor,
      outline,
      pickerRadius,
      pickerLengthScale,
      depthTest,
      renderOrder
    } = options;

    this.axis = axis;
    this.direction = direction;
    this.name = `translation-handle-${axis}-${directionName(direction)}`;
    this.#color = new THREE.Color(color);
    this.#hoverColor = new THREE.Color(hoverColor);
    this.#activeColor = new THREE.Color(activeColor);

    this.#visual = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: this.#color,
        transparent: true,
        depthTest,
        depthWrite: false,
        fog: false,
        toneMapped: false
      })
    );
    this.#visual.name = "translation-handle-visual";
    this.#visual.renderOrder = renderOrder + 1;
    this.#visual.frustumCulled = false;

    this.#outline = outline === false
      ? null
      : createTranslationOutline(
        geometry,
        outline,
        depthTest,
        renderOrder
      );

    const pickerLength = length * pickerLengthScale;
    this.picker = new THREE.Mesh(
      new THREE.CylinderGeometry(
        pickerRadius,
        pickerRadius,
        pickerLength,
        6
      ).translate(0, pickerLength / 2, 0),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.picker.name = "translation-handle-picker";
    this.picker.frustumCulled = false;

    if (this.#outline) {
      this.add(this.#outline);
    }
    this.add(this.#visual, this.picker);
  }

  get state(): TranslationHandleState {
    return this.#state;
  }

  set state(
    state: TranslationHandleState
  ) {
    if (state === this.#state) {
      return;
    }

    this.#state = state;
    let color = this.#color;
    if (state === "active") {
      color = this.#activeColor;
    }
    else if (state === "hovered") {
      color = this.#hoverColor;
    }
    this.#visual.material.color.copy(color);
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#visual.geometry.dispose();
    this.#visual.material.dispose();
    this.#outline?.geometry.dispose();
    this.#outline?.material.dispose();
    this.picker.geometry.dispose();
    this.picker.material.dispose();
    this.clear();
  }
}

function directionName(
  direction: TranslationDirection
): "negative" | "positive" {
  return direction === 1 ? "positive" : "negative";
}
