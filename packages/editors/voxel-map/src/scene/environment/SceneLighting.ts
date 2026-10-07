// Import Third-party Dependencies
import * as THREE from "three";
import type { Node } from "three/webgpu";
import type { BlockLightFalloff } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { LightingMode } from "../../state/ViewSettings.ts";
import { SkyBackground } from "./SkyBackground.ts";
import { NightSkyBackground } from "./NightSkyBackground.ts";

// CONSTANTS
const kSunDistance = 24;
const kOrigin = new THREE.Vector3();
const kDaySky = "#bcd6f2";
const kDayGround = "#8a7454";
const kEnvironmentIntensity = 0.6;

type Sky = new (sunDirection: THREE.Vector3) => { readonly node: Node; };

export interface LightingRig {
  ambient: number;
  hemisphere: number;
  skyColor: THREE.ColorRepresentation;
  groundColor: THREE.ColorRepresentation;
  sun: number;
  sunColor: THREE.ColorRepresentation;
  sunDirection: THREE.Vector3;
  toneMapping: THREE.ToneMapping | null;
  exposure: number;
  sky: Sky | null;
  environmentIntensity: number;
  blockLightFalloff: BlockLightFalloff;
  shadowFill: number;
}

const kRigs: Record<LightingMode, LightingRig> = {
  studio: {
    ambient: 1.3,
    hemisphere: 0,
    skyColor: kDaySky,
    groundColor: kDayGround,
    sun: 2.25,
    sunColor: "#ffffff",
    sunDirection: new THREE.Vector3(10, 20, 10).normalize(),
    toneMapping: null,
    exposure: 1,
    sky: null,
    environmentIntensity: kEnvironmentIntensity,
    blockLightFalloff: "wide",
    shadowFill: 0
  },
  flat: {
    ambient: Math.PI,
    hemisphere: 0,
    skyColor: kDaySky,
    groundColor: kDayGround,
    sun: 0,
    sunColor: "#ffffff",
    sunDirection: new THREE.Vector3(10, 20, 10).normalize(),
    toneMapping: THREE.NoToneMapping,
    exposure: 1,
    sky: null,
    environmentIntensity: kEnvironmentIntensity,
    blockLightFalloff: "wide",
    shadowFill: 0
  },
  daylight: {
    ambient: 0,
    hemisphere: 1.15,
    skyColor: kDaySky,
    groundColor: kDayGround,
    sun: 2.7,
    sunColor: "#ffd9a3",
    sunDirection: new THREE.Vector3(-0.62, 0.55, 0.56).normalize(),
    toneMapping: THREE.ACESFilmicToneMapping,
    exposure: 1.05,
    sky: SkyBackground,
    environmentIntensity: kEnvironmentIntensity,
    blockLightFalloff: "wide",
    shadowFill: 0
  },
  night: {
    ambient: 0,
    hemisphere: 0.35,
    skyColor: "#2c3a66",
    groundColor: "#14121c",
    sun: 0.55,
    sunColor: "#a9bce8",
    sunDirection: new THREE.Vector3(0.38, 0.78, -0.5).normalize(),
    toneMapping: THREE.ACESFilmicToneMapping,
    exposure: 0.9,
    sky: NightSkyBackground,
    environmentIntensity: 0.08,
    blockLightFalloff: "focused",
    shadowFill: 1
  }
};

export type { LightingMode };

export interface SceneLightingOutput {
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
}

export class SceneLighting {
  readonly ambient = new THREE.AmbientLight(0xffffff);
  readonly hemisphere = new THREE.HemisphereLight(kDaySky, kDayGround, 0);
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

  copySunDirectionTo(
    target: THREE.Vector3
  ): THREE.Vector3 {
    return target.copy(kRigs[this.#mode].sunDirection);
  }

  get rig(): Readonly<LightingRig> {
    return kRigs[this.#mode];
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
    this.hemisphere.color.set(rig.skyColor);
    this.hemisphere.groundColor.set(rig.groundColor);
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
