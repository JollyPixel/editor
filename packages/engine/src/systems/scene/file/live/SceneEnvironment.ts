// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { BakedRoomEnvironment } from "@jolly-pixel/three";

// Import Internal Dependencies
import type { World } from "../../../World.ts";
import type { Logger } from "../../../Logger.ts";
import type {
  SceneEnvironmentFile,
  SceneFogFile
} from "../SceneFile.ts";

export class SceneEnvironment {
  #world: World<any, any>;
  #scene: THREE.Scene;
  #logger: Logger;
  #room: THREE.RenderTarget | null = null;
  #wantsRoom = false;
  #disposed = false;

  constructor(
    world: World<any, any>
  ) {
    this.#world = world;
    this.#scene = world.sceneManager.getSource();
    this.#logger = world.logger.child({
      namespace: "Systems.SceneEnvironment"
    });
  }

  apply(
    file: SceneEnvironmentFile
  ): void {
    this.#scene.background = file.background === null ?
      null :
      new THREE.Color(file.background);
    this.#scene.fog = createFog(file.fog);
    this.#scene.environmentIntensity = file.environment.intensity;
    this.#wantsRoom = file.environment.kind === "room";
    this.#scene.environment = this.#wantsRoom ?
      this.#room?.texture ?? null :
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
          this.#world.renderer.getSource()
        );
        if (this.#wantsRoom) {
          this.#scene.environment = this.#room.texture;
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
    this.#scene.background = null;
    this.#scene.fog = null;
    this.#scene.environment = null;
    this.#scene.environmentIntensity = 1;
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
