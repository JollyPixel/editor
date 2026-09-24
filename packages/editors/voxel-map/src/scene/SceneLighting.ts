// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { LightingMode } from "../state/ViewStore.ts";

// CONSTANTS
const kSunDistance = 24;
const kOrigin = new THREE.Vector3();

interface LightingRig {
  ambient: number;
  hemisphere: number;
  sun: number;
  sunColor: THREE.ColorRepresentation;
  sunDirection: THREE.Vector3;
  toneMapping: THREE.ToneMapping | null;
  exposure: number;
}

const kRigs: Record<LightingMode, LightingRig> = {
  studio: {
    ambient: 1.3,
    hemisphere: 0,
    sun: 2.25,
    sunColor: "#ffffff",
    sunDirection: new THREE.Vector3(10, 20, 10).normalize(),
    toneMapping: null,
    exposure: 1
  },
  flat: {
    ambient: Math.PI,
    hemisphere: 0,
    sun: 0,
    sunColor: "#ffffff",
    sunDirection: new THREE.Vector3(10, 20, 10).normalize(),
    toneMapping: THREE.NoToneMapping,
    exposure: 1
  },
  daylight: {
    ambient: 0,
    hemisphere: 1.15,
    sun: 2.7,
    sunColor: "#ffd9a3",
    sunDirection: new THREE.Vector3(-0.62, 0.55, 0.56).normalize(),
    toneMapping: THREE.ACESFilmicToneMapping,
    exposure: 1.05
  }
};

export type { LightingMode };

export interface SceneLightingOutput {
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
}

export class SceneLighting {
  readonly ambient = new THREE.AmbientLight(0xffffff);
  readonly hemisphere = new THREE.HemisphereLight("#bcd6f2", "#8a7454", 0);
  readonly directional = new THREE.DirectionalLight(0xffffff);

  #mode: LightingMode = "studio";
  #output: SceneLightingOutput | undefined;
  #toneMapping: THREE.ToneMapping;
  #center = new THREE.Vector3();

  constructor(
    output?: SceneLightingOutput
  ) {
    this.#output = output;
    this.#toneMapping = output?.toneMapping ?? THREE.NoToneMapping;
    this.mode = "studio";
  }

  get lights(): THREE.Object3D[] {
    return [
      this.ambient,
      this.hemisphere,
      this.directional,
      this.directional.target
    ];
  }

  get sunDirection(): THREE.Vector3 {
    return kRigs[this.#mode].sunDirection.clone();
  }

  get mode(): LightingMode {
    return this.#mode;
  }

  set mode(
    mode: LightingMode
  ) {
    this.#mode = mode;

    const rig = kRigs[mode];
    this.ambient.intensity = rig.ambient;
    this.hemisphere.intensity = rig.hemisphere;
    this.directional.intensity = rig.sun;
    this.directional.color.set(rig.sunColor);
    this.aim(this.#center);
    if (this.#output) {
      this.#output.toneMapping = rig.toneMapping ?? this.#toneMapping;
      this.#output.toneMappingExposure = rig.exposure;
    }
  }

  aim(
    center: THREE.Vector3Like = kOrigin,
    distance = kSunDistance
  ): void {
    this.#center.copy(center);
    this.directional.target.position.copy(center);
    this.directional.position
      .copy(kRigs[this.#mode].sunDirection)
      .multiplyScalar(distance)
      .add(center);
  }
}
