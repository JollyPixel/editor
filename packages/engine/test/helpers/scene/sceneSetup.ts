// Import Node.js Dependencies
import { mock } from "node:test";

// Import Internal Dependencies
import { Logger } from "../../../src/systems/Logger.ts";
import { Actor } from "../../../src/actor/index.ts";
import { Scene } from "../../../src/systems/scene/Scene.ts";
import { SceneManager } from "../../../src/systems/scene/SceneManager.ts";
import {
  createSceneAssets,
  type SceneAssets
} from "./sceneAssets.ts";

export class ConcreteScene extends Scene {
  awakeSpy = mock.fn();
  startSpy = mock.fn();
  updateSpy = mock.fn();
  fixedUpdateSpy = mock.fn();
  destroySpy = mock.fn();
  override awake(): void {
    this.awakeSpy();
  }

  override start(): void {
    this.startSpy();
  }

  override update(deltaTime: number): void {
    this.updateSpy(deltaTime);
  }

  override fixedUpdate(deltaTime: number): void {
    this.fixedUpdateSpy(deltaTime);
  }

  override destroy(): void {
    this.destroySpy();
  }
}

export function createSceneSetup(
  assets: SceneAssets = createSceneAssets(),
  logger = new Logger()
) {
  const sm = new SceneManager();
  const world = {
    logger,
    sceneManager: sm,
    assetCoordinator: assets.coordinator,
    createActor(name: string) {
      return new Actor(this as any, { name });
    }
  };
  sm.bindWorld(world as any);

  return { sm, world };
}

export function activateScene(
  sceneManager: SceneManager,
  scene: Scene
): void {
  sceneManager.loadScene(scene);
  sceneManager.beginFrame();
}

export function activateAppendedScene(
  sceneManager: SceneManager,
  scene: Scene
): void {
  sceneManager.appendScene(scene);
  sceneManager.beginFrame();
}
