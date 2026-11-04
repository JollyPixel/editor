// Import Third-party Dependencies
import {
  ActorComponent,
  type Actor,
  type Model,
  type OrbitFlyCamera
} from "@jolly-pixel/engine";
import type { Grid } from "@jolly-pixel/three";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { AnimationPlayer } from "../player/AnimationPlayer.ts";
import type { ModelPreview } from "../preview/ModelPreview.ts";
import { createModelGrid } from "./modelGrid.ts";

// CONSTANTS
const kFraming = {
  margin: 1.5,
  minDistance: 1
} as const;

export interface ModelStageOptions {
  preview: ModelPreview;
  player: AnimationPlayer;
  camera: OrbitFlyCamera;
}

export class ModelStage extends ActorComponent {
  #options: ModelStageOptions;
  #shown: Model | null = null;
  #grid: Grid | null = null;
  #teardowns: Array<() => void> = [];

  constructor(
    actor: Actor,
    options: ModelStageOptions
  ) {
    super({
      actor,
      typeName: "ModelStage"
    });
    this.#options = options;
  }

  awake(): void {
    const { preview, player } = this.#options;
    this.#teardowns.push(
      preview.subscribe("change", () => this.#show()),
      this.actor.world.keepAlive(() => player.playing)
    );
    this.#present(preview.model);
  }

  update(
    deltaTime: number
  ): void {
    this.#options.player.update(deltaTime);
  }

  frame(): void {
    const bounds = this.#bounds();
    if (bounds.isEmpty()) {
      return;
    }

    const { camera } = this.#options;
    camera.frame(bounds, kFraming);
    camera.enterOrbitFocus(bounds.getCenter(new THREE.Vector3()));
  }

  #show(): void {
    const { model } = this.#options.preview;
    if (model !== this.#shown) {
      this.#present(model);
    }
  }

  #present(
    model: Model | null
  ): void {
    const { player } = this.#options;
    this.#shown?.object.removeFromParent();
    this.#shown = model;
    if (model === null) {
      player.unload();
    }
    else {
      this.actor.addChildren(model.object);
      player.load(model.object, model.animations);
    }
    this.#placeGrid(this.#bounds());
    this.frame();
    this.actor.world.invalidate();
  }

  #bounds(): THREE.Box3 {
    const bounds = new THREE.Box3();

    return this.#shown === null ?
      bounds :
      bounds.setFromObject(this.#shown.object);
  }

  #placeGrid(
    bounds: THREE.Box3
  ): void {
    this.#grid?.removeFromParent();
    this.#grid?.dispose();
    this.#grid = createModelGrid(bounds);
    this.actor.world.sceneManager.getSource().add(this.#grid);
  }

  protected override onDestroy(): void {
    for (const teardown of this.#teardowns.splice(0)) {
      teardown();
    }
    this.#options.player.unload();
    this.#shown?.object.removeFromParent();
    this.#shown = null;
    this.#grid?.removeFromParent();
    this.#grid?.dispose();
    this.#grid = null;
  }
}
