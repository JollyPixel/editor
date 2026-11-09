// Import Third-party Dependencies
import * as THREE from "three";
import type { Node } from "three/webgpu";
import type { ResolvedThemeMode } from "@jolly-pixel/ui";
import {
  DaySky,
  NightSky,
  StudioSky,
  type SkyConstructor
} from "@jolly-pixel/three";

// Import Internal Dependencies
import {
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
  backdrop: SkyConstructor | null;
  sky: THREE.ColorRepresentation;
  ground: THREE.ColorRepresentation;
  hemisphere: number;
  keyColor: THREE.ColorRepresentation;
  key: number;
  fillColor: THREE.ColorRepresentation;
  fill: number;
}

const kStudio: LightingPreset = {
  backdrop: null,
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
    backdrop: DaySky,
    sky: "#bcd6f2",
    ground: "#8a7454",
    hemisphere: 0.8,
    keyColor: "#ffd9a3",
    key: 1.9,
    fillColor: "#bcd6f2",
    fill: 0.15
  },
  night: {
    backdrop: NightSky,
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
  theme: ResolvedThemeMode;
}

export class ViewLighting {
  readonly hemisphere = new THREE.HemisphereLight();
  readonly key = new THREE.DirectionalLight();
  readonly fill = new THREE.DirectionalLight();
  readonly shadow: KeyLightShadow;

  #scene: THREE.Scene;
  #view: ViewSettingsStore;
  #environment: THREE.RenderTarget | null;
  #theme: ResolvedThemeMode;
  #studioSkies = new Map<ResolvedThemeMode, Node>();
  #outdoorSkies = new Map<`${LightingMode}:${KeyLightPreset}`, Node>();
  #unfollow: () => void;

  #apply = (
    settings: ViewSettings
  ): void => {
    const preset = kPresets[settings.lighting];
    const [x, y, z] = kKeyPositions[settings.keyLight];
    this.shadow.aim([x, y, z]);
    this.fill.position.set(-x, y * 0.5, -z);

    this.#scene.backgroundNode = this.#sky(settings);
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
    this.#view = options.view;
    this.#environment = options.environment;
    this.#theme = options.theme;
    this.shadow = new KeyLightShadow({
      light: this.key,
      casters: options.casters
    });

    this.#scene.environment = this.#environment?.texture ?? null;
    this.#scene.add(this.hemisphere, this.key, this.fill);
    this.#unfollow = this.#view.follow(this.#apply);
  }

  get theme(): ResolvedThemeMode {
    return this.#theme;
  }

  set theme(
    theme: ResolvedThemeMode
  ) {
    this.#theme = theme;
    this.#scene.backgroundNode = this.#sky(this.#view.settings);
  }

  dispose(): void {
    this.#unfollow();
    this.#scene.remove(this.hemisphere, this.key, this.fill);
    this.#scene.backgroundNode = null;
    this.#scene.environment = null;
    this.#environment?.dispose();
  }

  #sky(
    settings: ViewSettings
  ): Node {
    const { backdrop } = kPresets[settings.lighting];
    if (backdrop === null) {
      let studio = this.#studioSkies.get(this.#theme);
      if (studio === undefined) {
        studio = new StudioSky(this.#theme).node;
        this.#studioSkies.set(this.#theme, studio);
      }

      return studio;
    }

    const key = `${settings.lighting}:${settings.keyLight}` as const;
    let outdoor = this.#outdoorSkies.get(key);
    if (outdoor === undefined) {
      const direction = new THREE.Vector3(...kKeyPositions[settings.keyLight]);
      outdoor = new backdrop(direction.normalize()).node;
      this.#outdoorSkies.set(key, outdoor);
    }

    return outdoor;
  }
}
