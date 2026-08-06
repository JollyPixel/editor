// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

export class GridColor {
  readonly #color: THREE.Color;

  constructor(
    color: THREE.Color
  ) {
    this.#color = color;
  }

  get value(): string {
    return `#${this.#color.getHexString()}`;
  }

  set value(
    next: THREE.ColorRepresentation
  ) {
    this.#color.set(next);
  }
}
