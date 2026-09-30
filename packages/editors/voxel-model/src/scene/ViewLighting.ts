// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  KeyLightPreset,
  ViewSettings,
  ViewSettingsStore
} from "../state/index.ts";

// CONSTANTS
const kHemisphereIntensity = 0.35;
const kKeyIntensity = 1.6;
const kFillIntensity = 0.3;
const kKeyPositions: Record<KeyLightPreset, THREE.Vector3Tuple> = {
  "front-left": [-4, 6, 5],
  "front-right": [4, 6, 5],
  top: [0.5, 8, 1]
};

export interface ViewLightingOptions {
  scene: THREE.Scene;
  view: ViewSettingsStore;
}

export class ViewLighting {
  readonly hemisphere = new THREE.HemisphereLight("#dceaff", "#151820", kHemisphereIntensity);
  readonly key = new THREE.DirectionalLight("#ffffff", kKeyIntensity);
  readonly fill = new THREE.DirectionalLight("#cfd8ff", kFillIntensity);

  #scene: THREE.Scene;
  #view: ViewSettingsStore;
  #unfollow: () => void;
  #environment: THREE.Texture | null = null;
  #disposed = false;

  #apply = (
    settings: ViewSettings
  ): void => {
    const { exposure } = settings;
    const [x, y, z] = kKeyPositions[settings.keyLight];
    this.key.position.set(x, y, z);
    this.fill.position.set(-x, y * 0.5, -z);
    this.hemisphere.intensity = kHemisphereIntensity * exposure;
    this.key.intensity = kKeyIntensity * exposure;
    this.fill.intensity = kFillIntensity * exposure;

    this.#scene.environment = settings.environment ? this.#environment : null;
    this.#scene.environmentIntensity = settings.environmentIntensity * exposure;
  };

  constructor(
    options: ViewLightingOptions
  ) {
    this.#scene = options.scene;
    this.#view = options.view;

    this.#scene.add(this.hemisphere, this.key, this.fill);
    this.#unfollow = this.#view.follow(this.#apply);
  }

  async useEnvironment(
    pending: Promise<THREE.Texture>
  ): Promise<void> {
    const texture = await pending;
    if (this.#disposed) {
      texture.dispose();

      return;
    }

    this.#environment?.dispose();
    this.#environment = texture;
    this.#apply(this.#view.settings);
  }

  dispose(): void {
    this.#disposed = true;
    this.#unfollow();
    this.#scene.remove(this.hemisphere, this.key, this.fill);
    this.#scene.environment = null;
    this.#environment?.dispose();
  }
}
