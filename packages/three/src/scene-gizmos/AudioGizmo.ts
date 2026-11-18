// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  GIZMO_SELECTED_COLOR,
  GizmoIcon
} from "./GizmoIcon.ts";

export interface AudioGizmoOptions {
  /**
   * @default "#f5c46b"
   */
  selectedColor?: THREE.ColorRepresentation;
}

export class AudioGizmo extends THREE.Group {
  readonly #icon: GizmoIcon;

  constructor(
    options: AudioGizmoOptions = {}
  ) {
    super();
    const { selectedColor = GIZMO_SELECTED_COLOR } = options;

    this.#icon = new GizmoIcon("speaker", selectedColor);
    this.add(this.#icon);
  }

  get selected(): boolean {
    return this.#icon.selected;
  }

  set selected(
    selected: boolean
  ) {
    this.#icon.selected = selected;
  }

  update(
    position: THREE.Vector3Like,
    color: THREE.ColorRepresentation
  ): void {
    this.position.copy(position);
    this.#icon.color = color;
  }

  override dispose(): void {
    this.#icon.dispose();
  }
}
