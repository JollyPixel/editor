// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { World } from "../../core/systems/World.ts";
import type { SceneEnvironment } from "../../core/systems/scene/SceneGraph.ts";
import type { Logger } from "../../core/systems/Logger.ts";
import {
  BakedRoomEnvironment
} from "../rendering/environment/BakedRoomEnvironment.ts";
import { EmissiveGlow } from "../rendering/compositing/EmissiveGlow.ts";
import type { ThreeSceneGraph } from "./ThreeSceneGraph.ts";
import type {
  SceneEnvironmentFile,
  SceneFogFile
} from "../../core/systems/scene/file/SceneFile.ts";

export class ThreeSceneEnvironment implements SceneEnvironment {
  #world: World<any, any>;
  #graph: ThreeSceneGraph;
  #logger: Logger;
  #glow = new EmissiveGlow();
  #room: THREE.RenderTarget | null = null;
  #wantsRoom = false;
  #disposed = false;

  constructor(
    graph: ThreeSceneGraph,
    world: World<any, any>
  ) {
    this.#world = world;
    this.#graph = graph;
    this.#logger = world.logger.child({
      namespace: "Systems.SceneEnvironment"
    });
  }

  apply(
    file: SceneEnvironmentFile
  ): void {
    this.#graph.scene.background = file.background === null ?
      null :
      new THREE.Color(file.background);
    this.#graph.scene.fog = createFog(file.fog);
    this.#graph.scene.environmentIntensity = file.environment.intensity;
    this.#wantsRoom = file.environment.kind === "room";
    this.#graph.scene.environment = this.#wantsRoom ?
      this.#room?.texture ?? null :
      null;

    this.#graph.postProcessing = file.glow ?
      this.#glow.apply(file.glow) :
      null;

    if (this.#wantsRoom && this.#room === null) {
      this.#loadRoom();
    }
  }

  #loadRoom(): void {
    BakedRoomEnvironment.load().then(
      (room) => {
        if (this.#disposed || this.#room !== null) {
          return;
        }
        this.#room = room.createRenderTarget(
          this.#world.renderer.source
        );
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
    this.#graph.scene.background = null;
    this.#graph.scene.fog = null;
    this.#graph.scene.environment = null;
    this.#graph.scene.environmentIntensity = 1;
    this.#graph.postProcessing = null;
    this.#room?.dispose();
    this.#room = null;
  }
}

function createFog(
  fog: SceneFogFile
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
