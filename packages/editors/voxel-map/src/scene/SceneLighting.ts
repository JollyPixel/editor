// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kAmbientIntensity = 1.3;
const kDirectionalIntensity = 2.25;
const kFlatAmbientIntensity = Math.PI;
const kLightPosition = {
  x: 10,
  y: 20,
  z: 10
};
const kExposure = 1;

export type LightingMode = "lit" | "flat";

export interface SceneLightingOutput {
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
}

export class SceneLighting {
  readonly ambient = new THREE.AmbientLight(0xffffff, kAmbientIntensity);
  readonly directional = new THREE.DirectionalLight(
    0xffffff,
    kDirectionalIntensity
  );

  #mode: LightingMode = "lit";
  #output: SceneLightingOutput | undefined;
  #toneMapping: THREE.ToneMapping;

  constructor(
    output?: SceneLightingOutput
  ) {
    this.directional.position.set(
      kLightPosition.x,
      kLightPosition.y,
      kLightPosition.z
    );
    this.#output = output;
    this.#toneMapping = output?.toneMapping ?? THREE.NoToneMapping;
    if (output) {
      output.toneMappingExposure = kExposure;
    }
  }

  get lights(): [THREE.AmbientLight, THREE.DirectionalLight] {
    return [this.ambient, this.directional];
  }

  get mode(): LightingMode {
    return this.#mode;
  }

  set mode(
    mode: LightingMode
  ) {
    this.#mode = mode;

    const flat = mode === "flat";
    this.ambient.intensity = flat ? kFlatAmbientIntensity : kAmbientIntensity;
    this.directional.intensity = flat ? 0 : kDirectionalIntensity;
    if (this.#output) {
      this.#output.toneMapping = flat ?
        THREE.NoToneMapping :
        this.#toneMapping;
    }
  }
}
