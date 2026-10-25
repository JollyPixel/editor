// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ActorComponent } from "../../actor/ActorComponent.ts";
import type { Actor } from "../../actor/Actor.ts";
import type { WorldDefaultContext } from "../../systems/World.ts";

export type LightKind =
  | "ambient"
  | "hemisphere"
  | "directional"
  | "point"
  | "spot";

export interface LightOptions {
  /**
   * @default "directional"
   */
  kind?: LightKind;
  /**
   * Light color, the sky color of a hemisphere light.
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Ground color of a hemisphere light.
   * @default "#444444"
   */
  groundColor?: THREE.ColorRepresentation;
  /**
   * @default 1
   */
  intensity?: number;
  /**
   * Range of a point or spot light. 0 means no limit.
   * @default 0
   */
  distance?: number;
  /**
   * Dimming along the distance of a point or spot light.
   * @default 2
   */
  decay?: number;
  /**
   * Cone angle of a spot light in degrees.
   * @default 60
   */
  angle?: number;
  /**
   * Share of a spot light cone attenuated by penumbra, in [0, 1].
   * @default 0
   */
  penumbra?: number;
  /**
   * Ignored by ambient and hemisphere lights.
   * @default false
   */
  castShadow?: boolean;
  /**
   * Width and height of the shadow map in texels.
   * @default 1024
   */
  shadowMapSize?: number;
  /**
   * @default 0
   */
  shadowBias?: number;
}

export type LightSettings = Required<LightOptions>;

interface LightRig {
  readonly light: THREE.Light;
  write(settings: LightSettings): void;
}

// CONSTANTS
export const LIGHT_DEFAULTS = {
  kind: "directional",
  color: "#ffffff",
  groundColor: "#444444",
  intensity: 1,
  distance: 0,
  decay: 2,
  angle: 60,
  penumbra: 0,
  castShadow: false,
  shadowMapSize: 1024,
  shadowBias: 0
} as const satisfies LightSettings;

const kLightRigs: Record<LightKind, () => LightRig> = {
  ambient: () => {
    const light = new THREE.AmbientLight();

    return {
      light,
      write: (settings) => writeColor(light, settings)
    };
  },
  hemisphere: () => {
    const light = new THREE.HemisphereLight();

    return {
      light,
      write: (settings) => {
        writeColor(light, settings);
        light.groundColor.set(settings.groundColor);
      }
    };
  },
  directional: () => {
    const light = new THREE.DirectionalLight();
    aimForward(light);

    return {
      light,
      write: (settings) => {
        writeColor(light, settings);
        writeShadow(light, settings);
      }
    };
  },
  point: () => {
    const light = new THREE.PointLight();

    return {
      light,
      write: (settings) => {
        writeColor(light, settings);
        light.distance = settings.distance;
        light.decay = settings.decay;
        writeShadow(light, settings);
      }
    };
  },
  spot: () => {
    const light = new THREE.SpotLight();
    aimForward(light);

    return {
      light,
      write: (settings) => {
        writeColor(light, settings);
        light.distance = settings.distance;
        light.decay = settings.decay;
        light.angle = THREE.MathUtils.degToRad(
          settings.angle
        );
        light.penumbra = settings.penumbra;
        writeShadow(light, settings);
      }
    };
  }
};

export class LightComponent<
  TContext = WorldDefaultContext
> extends ActorComponent<TContext> {
  #settings: LightSettings;
  #rig: LightRig;

  constructor(
    actor: Actor<TContext>,
    options: LightOptions = {}
  ) {
    super({
      actor,
      typeName: "Light"
    });

    this.#settings = {
      ...LIGHT_DEFAULTS,
      ...options
    };
    this.#rig = this.#mountRig();
    this.addTeardown(() => this.#unmountRig());
  }

  get threeLight(): THREE.Light {
    return this.#rig.light;
  }

  get kind(): LightKind {
    return this.#settings.kind;
  }

  configure(
    options: LightOptions
  ): this {
    const previousKind = this.#settings.kind;
    this.#settings = {
      ...this.#settings,
      ...options
    };

    if (this.#settings.kind === previousKind) {
      this.#rig.write(this.#settings);
    }
    else {
      this.#unmountRig();
      this.#rig = this.#mountRig();
    }

    return this;
  }

  #mountRig(): LightRig {
    const rig = kLightRigs[this.#settings.kind]();
    rig.write(this.#settings);
    this.actor.object3D.add(rig.light);

    return rig;
  }

  #unmountRig(): void {
    this.actor.object3D.remove(this.#rig.light);
    this.#rig.light.dispose();
  }
}

function writeColor(
  light: THREE.Light,
  settings: LightSettings
): void {
  light.color.set(settings.color);
  light.intensity = settings.intensity;
}

function writeShadow(
  light: THREE.DirectionalLight | THREE.PointLight | THREE.SpotLight,
  settings: LightSettings
): void {
  light.castShadow = settings.castShadow;
  light.shadow.bias = settings.shadowBias;

  const size = settings.shadowMapSize;
  if (
    light.shadow.mapSize.x !== size ||
    light.shadow.mapSize.y !== size
  ) {
    light.shadow.mapSize.set(size, size);
    light.shadow.map?.dispose();
    light.shadow.map = null;
  }
}

function aimForward(
  light: THREE.DirectionalLight | THREE.SpotLight
): void {
  light.position.set(0, 0, 0);
  light.target.position.set(0, 0, -1);
  light.add(light.target);
}
