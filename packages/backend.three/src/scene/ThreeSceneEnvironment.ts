// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import {
  BakedRoomEnvironment
} from "../rendering/environment/BakedRoomEnvironment.ts";
import { DaySky } from "../rendering/environment/sky/DaySky.ts";
import { NightSky } from "../rendering/environment/sky/NightSky.ts";
import type { SkyConstructor } from "../rendering/environment/sky/SkyConstructor.ts";
import { EmissiveGlow } from "../rendering/compositing/EmissiveGlow.ts";
import type { ThreeSceneGraph } from "./ThreeSceneGraph.ts";

// CONSTANTS
const kSunDistance = 24;
const kSkies: Record<"day" | "night", SkyConstructor> = {
  day: DaySky,
  night: NightSky
};
const kToneMappings: Record<Systems.EnvironmentToneMappingKind, THREE.ToneMapping> = {
  none: THREE.NoToneMapping,
  neutral: THREE.NeutralToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping
};

export interface ThreeSceneEnvironmentOptions {
  /**
   * A loaded room map, used without waiting for `BakedRoomEnvironment.load`.
   */
  room?: BakedRoomEnvironment | null;
}

interface RendererOutput {
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
}

export class ThreeSceneEnvironment implements Systems.SceneEnvironment {
  readonly sun = new THREE.DirectionalLight();
  readonly ambient = new THREE.HemisphereLight();

  #world: Systems.World<any, any>;
  #graph: ThreeSceneGraph;
  #logger: Systems.Logger;
  #glow = new EmissiveGlow();
  #room: THREE.RenderTarget | null = null;
  #loadedRoom: BakedRoomEnvironment | null;
  #wantsRoom = false;
  #disposed = false;
  #skies = new Map<keyof typeof kSkies, THREE.Node>();
  #sky: Readonly<Systems.EnvironmentSkyFile> = {
    kind: "none"
  };
  #fallbackSky: THREE.Node | null = null;
  #sunDirection = new THREE.Vector3(0, 1, 0);
  #sunCenter = new THREE.Vector3();
  #sunDistance = kSunDistance;
  #initialOutput: RendererOutput | null;

  constructor(
    graph: ThreeSceneGraph,
    world: Systems.World<any, any>,
    options: ThreeSceneEnvironmentOptions = {}
  ) {
    this.#world = world;
    this.#graph = graph;
    this.#loadedRoom = options.room ?? null;
    this.#logger = world.logger.child({
      namespace: "Systems.SceneEnvironment"
    });

    const output = this.#output();
    this.#initialOutput = output === null ?
      null :
      {
        toneMapping: output.toneMapping,
        toneMappingExposure: output.toneMappingExposure
      };

    this.sun.intensity = 0;
    this.ambient.intensity = 0;
    graph.scene.add(this.sun, this.sun.target, this.ambient);
  }

  apply(
    file: Readonly<Systems.EnvironmentFile>
  ): void {
    const { scene } = this.#graph;

    this.#applySun(file.sun);
    this.ambient.color.set(file.ambient.skyColor);
    this.ambient.groundColor.set(file.ambient.groundColor);
    this.ambient.intensity = file.ambient.intensity;
    this.#applySky(file.sky);
    scene.fog = createFog(file.fog);

    scene.environmentIntensity = file.reflections.intensity;
    this.#wantsRoom = file.reflections.kind === "room";
    scene.environment = this.#wantsRoom ?
      this.#room?.texture ?? null :
      null;

    const output = this.#output();
    if (output !== null) {
      output.toneMapping = kToneMappings[file.toneMapping.kind];
      output.toneMappingExposure = file.toneMapping.exposure;
    }

    this.#graph.postProcessing = file.glow ?
      this.#glow.apply(file.glow) :
      null;
    this.#graph.environment = file;

    if (this.#wantsRoom && this.#room === null && output !== null) {
      if (this.#loadedRoom === null) {
        this.#loadRoom(output);
      }
      else {
        this.#room = this.#loadedRoom.createRenderTarget(output);
        scene.environment = this.#room.texture;
      }
    }
  }

  get fallbackSky(): THREE.Node | null {
    return this.#fallbackSky;
  }

  set fallbackSky(
    node: THREE.Node | null
  ) {
    this.#fallbackSky = node;
    this.#applySky(this.#sky);
  }

  copySunDirectionTo(
    target: THREE.Vector3
  ): THREE.Vector3 {
    return target.copy(this.#sunDirection);
  }

  aimSun(
    center: THREE.Vector3Like = this.#sunCenter,
    distance = this.#sunDistance
  ): void {
    this.#sunCenter.copy(center);
    this.#sunDistance = distance;
    this.sun.target.position.copy(this.#sunCenter);
    this.sun.position
      .copy(this.#sunDirection)
      .multiplyScalar(distance)
      .add(this.#sunCenter);
  }

  #applySun(
    sun: Readonly<Systems.EnvironmentSunFile> | null
  ): void {
    if (sun === null) {
      this.sun.intensity = 0;

      return;
    }

    this.sun.color.set(sun.color);
    this.sun.intensity = sun.intensity;
    sunDirection(sun, this.#sunDirection);
    this.aimSun();
  }

  #applySky(
    sky: Readonly<Systems.EnvironmentSkyFile>
  ): void {
    const { scene } = this.#graph;
    this.#sky = sky;

    switch (sky.kind) {
      case "color":
        scene.background = new THREE.Color(sky.color);
        scene.backgroundNode = null;
        break;
      case "day":
      case "night":
        scene.background = null;
        scene.backgroundNode = this.#skyNode(sky.kind);
        break;
      default:
        scene.background = null;
        scene.backgroundNode = this.#fallbackSky;
    }
  }

  #skyNode(
    kind: keyof typeof kSkies
  ): THREE.Node {
    let node = this.#skies.get(kind);
    if (node === undefined) {
      node = new kSkies[kind](this.#sunDirection).node;
      this.#skies.set(kind, node);
    }

    return node;
  }

  #output(): THREE.WebGPURenderer | null {
    return this.#world.renderer.source ?? null;
  }

  #loadRoom(
    renderer: THREE.WebGPURenderer
  ): void {
    BakedRoomEnvironment.load().then(
      (room) => {
        if (this.#disposed || this.#room !== null) {
          return;
        }
        this.#room = room.createRenderTarget(renderer);
        if (this.#wantsRoom) {
          this.#graph.scene.environment = this.#room.texture;
          this.#world.invalidate();
        }
      },
      (error: unknown) => {
        this.#logger.warn("Room environment unavailable", {
          error: String(error)
        });
      }
    );
  }

  dispose(): void {
    this.#disposed = true;

    const { scene } = this.#graph;
    scene.remove(this.sun, this.sun.target, this.ambient);
    this.sun.dispose();
    this.ambient.dispose();
    scene.background = null;
    scene.backgroundNode = null;
    scene.fog = null;
    scene.environment = null;
    scene.environmentIntensity = 1;
    this.#graph.postProcessing = null;
    this.#graph.environment = null;

    const output = this.#output();
    if (output !== null && this.#initialOutput !== null) {
      output.toneMapping = this.#initialOutput.toneMapping;
      output.toneMappingExposure = this.#initialOutput.toneMappingExposure;
    }

    this.#room?.dispose();
    this.#room = null;
  }
}

function sunDirection(
  sun: Readonly<Systems.EnvironmentSunFile>,
  target: THREE.Vector3
): THREE.Vector3 {
  const azimuth = THREE.MathUtils.degToRad(sun.azimuth);
  const elevation = THREE.MathUtils.degToRad(sun.elevation);
  const horizontal = Math.cos(elevation);

  return target.set(
    horizontal * Math.sin(azimuth),
    Math.sin(elevation),
    horizontal * Math.cos(azimuth)
  );
}

function createFog(
  fog: Readonly<Systems.EnvironmentFogFile>
): THREE.Fog | THREE.FogExp2 | null {
  switch (fog.kind) {
    case "linear":
      return new THREE.Fog(fog.color, fog.near, fog.far);
    case "exp2":
      return new THREE.FogExp2(fog.color, fog.density);
    default:
      return null;
  }
}
