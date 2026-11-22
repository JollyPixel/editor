// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Systems } from "@jolly-pixel/ecs";
import { type BakedRoomEnvironment, ThreeSceneEnvironment } from "@jolly-pixel/backend.three";
import type { ResolvedThemeMode } from "@jolly-pixel/ui";
import { StudioSky } from "@jolly-pixel/three";
import type { PreviewEnvironment } from "@jolly-pixel/asset.environment/client";

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

type OutdoorLighting = Exclude<LightingMode, "flat" | "studio">;

// CONSTANTS
const kKeyPositions: Record<KeyLightPreset, THREE.Vector3Tuple> = {
  "front-left": [-4, 6, 5],
  "front-right": [4, 6, 5],
  top: [0.5, 8, 1]
};
const kStudioFill = 0.3;
const kStudioFillColor = "#cfd8ff";
const kStudioKey = 1.6;
const kStudio: Systems.EnvironmentFile = {
  ...Systems.ENVIRONMENT_PRESETS.default,
  ambient: {
    skyColor: "#dceaff",
    groundColor: "#151820",
    intensity: 0.35
  },
  reflections: {
    kind: "room",
    intensity: 0.5
  }
};
const kOutdoor: Readonly<
  Record<OutdoorLighting, Readonly<Systems.EnvironmentFile>>
> = {
  day: Systems.ENVIRONMENT_PRESETS.day,
  night: Systems.ENVIRONMENT_PRESETS.night
};

export interface ViewLightingOptions {
  world: Systems.World<THREE.WebGPURenderer, any>;
  view: ViewSettingsStore;
  preview: Pick<PreviewEnvironment, "linked" | "resolve" | "subscribe">;
  room: BakedRoomEnvironment | null;
  casters: () => Iterable<ShadowCaster>;
  theme: ResolvedThemeMode;
}

export class ViewLighting {
  readonly key: THREE.DirectionalLight;
  readonly fill = new THREE.DirectionalLight(kStudioFillColor);
  readonly shadow: KeyLightShadow;

  #scene: THREE.Scene;
  #environment: ThreeSceneEnvironment;
  #view: ViewSettingsStore;
  #preview: ViewLightingOptions["preview"];
  #theme: ResolvedThemeMode;
  #sunDirection = new THREE.Vector3();
  #unfollow: Array<() => void>;

  #apply = (
    settings: ViewSettings
  ): void => {
    this.#environment.apply(
      this.#preview.resolve(presetEnvironment(settings), settings)
    );

    const [x, y, z] = kKeyPositions[settings.keyLight];
    this.fill.position.set(-x, y * 0.5, -z);
    this.fill.intensity = !this.#preview.linked && isStudio(settings.lighting) ?
      kStudioFill :
      0;

    const direction = this.#environment.copySunDirectionTo(this.#sunDirection);
    this.shadow.aim(direction.toArray());
    this.shadow.invalidate();
    this.shadow.enabled = settings.shadows && isLit(settings);
  };

  constructor(
    options: ViewLightingOptions
  ) {
    const { world } = options;
    const { graph } = world.sceneManager;
    this.#scene = graph.scene;
    this.#environment = new ThreeSceneEnvironment(graph, world, {
      room: options.room
    });
    this.#environment.fallbackSky = new StudioSky(options.theme).node;
    this.key = this.#environment.sun;
    this.#view = options.view;
    this.#preview = options.preview;
    this.#theme = options.theme;
    this.shadow = new KeyLightShadow({
      light: this.key,
      casters: options.casters
    });

    this.#scene.add(this.fill);
    this.#unfollow = [
      this.#view.follow(this.#apply),
      this.#preview.subscribe("change", () => this.#apply(this.#view.settings))
    ];
  }

  get theme(): ResolvedThemeMode {
    return this.#theme;
  }

  set theme(
    theme: ResolvedThemeMode
  ) {
    if (theme !== this.#theme) {
      this.#theme = theme;
      this.#environment.fallbackSky = new StudioSky(theme).node;
    }
  }

  dispose(): void {
    for (const unfollow of this.#unfollow) {
      unfollow();
    }
    this.#scene.remove(this.fill);
    this.#environment.dispose();
  }
}

function isStudio(
  lighting: LightingMode
): lighting is Exclude<LightingMode, OutdoorLighting> {
  return lighting === "flat" || lighting === "studio";
}

function presetEnvironment(
  settings: ViewSettings
): Readonly<Systems.EnvironmentFile> {
  return isStudio(settings.lighting) ?
    studioEnvironment(settings.keyLight) :
    kOutdoor[settings.lighting];
}

function studioEnvironment(
  keyLight: KeyLightPreset
): Systems.EnvironmentFile {
  const [x, y, z] = kKeyPositions[keyLight];
  const horizontal = Math.hypot(x, z);

  return {
    ...kStudio,
    sun: {
      color: "#ffffff",
      intensity: kStudioKey,
      azimuth: THREE.MathUtils.radToDeg(Math.atan2(x, z)),
      elevation: THREE.MathUtils.radToDeg(Math.atan2(y, horizontal))
    }
  };
}
