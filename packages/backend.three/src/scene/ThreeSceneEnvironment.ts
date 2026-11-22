// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import {
  BakedRoomEnvironment
} from "../rendering/environment/BakedRoomEnvironment.ts";
import { daySky } from "../rendering/environment/sky/daySky.ts";
import { nightSky } from "../rendering/environment/sky/nightSky.ts";
import { EmissiveGlow } from "../rendering/compositing/EmissiveGlow.ts";
import type { ThreeSceneGraph } from "./ThreeSceneGraph.ts";

// CONSTANTS
const kSunDistance = 24;
const kSkies: Record<"day" | "night", (direction: THREE.Vector3) => THREE.Node> = {
  day: daySky,
  night: nightSky
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
  #renderer: THREE.WebGPURenderer | null;
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
    this.#renderer = world.renderer.source ?? null;
    this.#graph = graph;
    this.#loadedRoom = options.room ?? null;
    this.#logger = world.logger.child({
      namespace: "Systems.SceneEnvironment"
    });

    const renderer = this.#renderer;
    this.#initialOutput = renderer === null ?
      null :
      {
        toneMapping: renderer.toneMapping,
        toneMappingExposure: renderer.toneMappingExposure
      };

    this.sun.intensity = 0;
    this.ambient.intensity = 0;
    graph.scene.add(this.sun, this.sun.target, this.ambient);
  }

  apply(
    file: Readonly<Systems.EnvironmentFile>
  ): void {
    this.#applySun(file.sun);
    this.#applyAmbient(file.ambient);
    this.#applySky(file.sky);
    this.#graph.scene.fog = createFog(file.fog);
    this.#applyToneMapping(file.toneMapping);
    this.#applyReflections(file.reflections);
    this.#graph.postProcessing = file.glow ?
      this.#glow.apply(file.glow) :
      null;
    this.#graph.environment = file;
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

  #applyAmbient(
    ambient: Readonly<Systems.EnvironmentFile["ambient"]>
  ): void {
    this.ambient.color.set(ambient.skyColor);
    this.ambient.groundColor.set(ambient.groundColor);
    this.ambient.intensity = ambient.intensity;
  }

  #applyToneMapping(
    toneMapping: Readonly<Systems.EnvironmentFile["toneMapping"]>
  ): void {
    if (this.#renderer !== null) {
      this.#renderer.toneMapping = kToneMappings[toneMapping.kind];
      this.#renderer.toneMappingExposure = toneMapping.exposure;
    }
  }

  #applyReflections(
    reflections: Readonly<Systems.EnvironmentFile["reflections"]>
  ): void {
    const { scene } = this.#graph;
    scene.environmentIntensity = reflections.intensity;
    this.#wantsRoom = reflections.kind === "room";
    scene.environment = this.#wantsRoom ? this.#roomTexture() : null;
  }

  #roomTexture(): THREE.Texture | null {
    const renderer = this.#renderer;
    if (this.#room === null && renderer !== null) {
      if (this.#loadedRoom === null) {
        this.#loadRoom(renderer);
      }
      else {
        this.#room = this.#loadedRoom.createRenderTarget(renderer);
      }
    }

    return this.#room?.texture ?? null;
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
      node = kSkies[kind](this.#sunDirection);
      this.#skies.set(kind, node);
    }

    return node;
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

    if (this.#renderer !== null && this.#initialOutput !== null) {
      this.#renderer.toneMapping = this.#initialOutput.toneMapping;
      this.#renderer.toneMappingExposure = this.#initialOutput.toneMappingExposure;
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
