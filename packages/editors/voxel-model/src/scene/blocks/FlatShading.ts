// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import {
  diffuseColor,
  emissive,
  mix,
  output,
  uniform,
  vec4
} from "three/tsl";

export class FlatShading {
  readonly #amount = uniform(0);
  readonly #output = mix(
    output,
    vec4(diffuseColor.rgb.add(emissive), diffuseColor.a).max(0),
    this.#amount
  );

  get flat(): boolean {
    return this.#amount.value === 1;
  }

  set flat(
    flat: boolean
  ) {
    this.#amount.value = flat ? 1 : 0;
  }

  shade(
    target: THREE.MeshStandardNodeMaterial
  ): void {
    target.outputNode = this.#output;
  }
}
