// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  backgroundOf,
  isLit,
  type KeyLightPreset,
  type LightingMode,
  type ViewSettings,
  type ViewSettingsStore
} from "../state/index.ts";
import {
  KeyLightShadow,
  type ShadowCaster
} from "./KeyLightShadow.ts";

// CONSTANTS
const kKeyPositions: Record<KeyLightPreset, THREE.Vector3Tuple> = {
  "front-left": [-4, 6, 5],
  "front-right": [4, 6, 5],
  top: [0.5, 8, 1]
};
const kReflectionIntensity = 0.5;

interface LightingPreset {
  sky: THREE.ColorRepresentation;
  ground: THREE.ColorRepresentation;
  hemisphere: number;
  keyColor: THREE.ColorRepresentation;
  key: number;
  fillColor: THREE.ColorRepresentation;
  fill: number;
}

const kStudio: LightingPreset = {
  sky: "#dceaff",
  ground: "#151820",
  hemisphere: 0.35,
  keyColor: "#ffffff",
  key: 1.6,
  fillColor: "#cfd8ff",
  fill: 0.3
};
const kPresets: Record<LightingMode, LightingPreset> = {
  flat: kStudio,
  studio: kStudio,
  day: {
    sky: "#bcd6f2",
    ground: "#8a7454",
    hemisphere: 0.8,
    keyColor: "#ffd9a3",
    key: 1.9,
    fillColor: "#bcd6f2",
    fill: 0.15
  },
  night: {
    sky: "#41507a",
    ground: "#06070b",
    hemisphere: 0.2,
    keyColor: "#a9bcff",
    key: 0.45,
    fillColor: "#55628c",
    fill: 0.08
  }
};

export interface ViewLightingOptions {
  scene: THREE.Scene;
  view: ViewSettingsStore;
  environment: THREE.RenderTarget | null;
  casters: () => Iterable<ShadowCaster>;
}

export class ViewLighting {
  readonly hemisphere = new THREE.HemisphereLight();
  readonly key = new THREE.DirectionalLight();
  readonly fill = new THREE.DirectionalLight();
  readonly background = new THREE.Color();
  readonly shadow: KeyLightShadow;

  #scene: THREE.Scene;
  #environment: THREE.RenderTarget | null;
  #unfollow: () => void;

  #apply = (
    settings: ViewSettings
  ): void => {
    const preset = kPresets[settings.lighting];
    const [x, y, z] = kKeyPositions[settings.keyLight];
    this.shadow.aim([x, y, z]);
    this.fill.position.set(-x, y * 0.5, -z);

    this.background.set(backgroundOf(settings));
    this.hemisphere.color.set(preset.sky);
    this.hemisphere.groundColor.set(preset.ground);
    this.hemisphere.intensity = preset.hemisphere;
    this.key.color.set(preset.keyColor);
    this.key.intensity = preset.key;
    this.fill.color.set(preset.fillColor);
    this.fill.intensity = preset.fill;

    this.shadow.enabled = settings.shadows && isLit(settings);
    this.#scene.environmentIntensity = settings.reflections ? kReflectionIntensity : 0;
  };

  constructor(
    options: ViewLightingOptions
  ) {
    this.#scene = options.scene;
    this.#environment = options.environment;
    this.shadow = new KeyLightShadow({
      light: this.key,
      casters: options.casters
    });

    this.#scene.background = this.background;
    this.#scene.environment = this.#environment?.texture ?? null;
    this.#scene.add(this.hemisphere, this.key, this.fill);
    this.#unfollow = options.view.follow(this.#apply);
  }

  dispose(): void {
    this.#unfollow();
    this.#scene.remove(this.hemisphere, this.key, this.fill);
    this.#scene.background = null;
    this.#scene.environment = null;
    this.#environment?.dispose();
  }
}
