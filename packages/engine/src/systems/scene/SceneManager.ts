// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  Actor,
  ActorComponent,
  ActorTree
} from "../../actor/index.ts";

import type {
  World,
  WorldDefaultContext
} from "../World.ts";
import type { Component } from "../../components/types.ts";
import type { Scene } from "./Scene.ts";
import type { Logger } from "../Logger.ts";
import { ManagedSceneLoad } from "./ManagedSceneLoad.ts";
import { SceneLoadController } from "./SceneLoadController.ts";
import type {
  SceneLoad,
  SceneLoadOptions
} from "./SceneLoad.ts";
import type { SceneLoader } from "./SceneLoader.ts";

export type AppendedSceneEntry<TContext> = {
  scene: Scene<TContext>;
  /**
   * All actors created during the scene's awake(),
   * tracked for cleanup on removeScene.
   **/
  ownedActors: ReadonlySet<Actor<TContext>>;
};

export type SceneEvents<TContext = WorldDefaultContext> = {
  awake: () => void;
  sceneChanged: (
    scene: Scene<TContext>
  ) => void;
  sceneDestroyed: (
    scene: Scene<TContext>
  ) => void;
  sceneAppended: (
    scene: Scene<TContext>
  ) => void;
  sceneRemoved: (
    scene: Scene<TContext>
  ) => void;
  sceneLoadRequested: (
    load: SceneLoad<TContext>
  ) => void;
  sceneLoadChanged: (
    load: SceneLoad<TContext>
  ) => void;
};

/**
 * Owns scene loading state and applies changes at frame boundaries.
 */
export class SceneManager<
  TContext = WorldDefaultContext
> extends Emitter<SceneEvents<TContext>> {
  default: THREE.Scene;

  componentsToBeStarted: Component[] = [];
  componentsToBeDestroyed: Component[] = [];

  #registeredActors: Set<Actor<TContext>> = new Set();
  #actorsByName: Map<string, Actor<TContext>[]> = new Map();
  #cachedActors: Actor<TContext>[] = [];

  #currentScene: Scene<TContext> | null = null;
  #pendingScene: Scene<TContext> | null = null;
  #sceneLoad: SceneLoad<TContext> | null = null;
  #sceneLoadController: SceneLoadController<TContext> | null = null;
  #pendingSceneLoadController: SceneLoadController<TContext> | null = null;
  #sceneLoader: SceneLoader<TContext> | null = null;
  #sceneStartPending = false;
  #world: World<any, TContext> | null = null;
  #logger!: Logger;

  #appendedScenes: Map<number, AppendedSceneEntry<TContext>> = new Map();
  #appendedScenesPendingStart: Set<number> = new Set();
  #appendedSceneLoads: Map<
    number,
    SceneLoadController<TContext>
  > = new Map();
  #pendingAppendedSceneLoads: Map<
    number,
    SceneLoadController<TContext>
  > = new Map();

  readonly tree = new ActorTree<TContext>({
    addCallback: (actor) => this.default.add(actor.object3D),
    removeCallback: (actor) => this.default.remove(actor.object3D)
  });

  constructor(
    scene?: THREE.Scene
  ) {
    super();
    this.default = scene ?? new THREE.Scene();
  }

  get currentScene(): Scene<TContext> | null {
    return this.#currentScene;
  }

  get hasPendingScene(): boolean {
    return this.#pendingScene !== null;
  }

  get sceneLoad(): SceneLoad<TContext> | null {
    return this.#sceneLoad;
  }

  getSource() {
    return this.default;
  }

  bindWorld(
    world: World<any, TContext>
  ): void {
    this.#world = world;
    this.#logger = world.logger.child({
      namespace: "Systems.SceneManager"
    });
  }

  setSceneLoader(
    loader: SceneLoader<TContext>
  ): void {
    this.#sceneLoader = loader;
  }

  awake() {
    for (const { actor } of this.tree.walk()) {
      if (!actor.awoken) {
        actor.awake();
        actor.awoken = true;
      }
    }
    this.emit("awake");
  }

  #activateScene(
    scene: Scene<TContext>
  ): void {
    this.#cancelAppendedSceneLoads();

    if (this.#currentScene !== null) {
      this.#logger.debug("Tearing down current scene", {
        scene: this.#currentScene.name
      });

      for (const entry of this.#appendedScenes.values()) {
        this.emit(
          "sceneRemoved",
          entry.scene
        );
        entry.scene.destroy();
      }
      this.#appendedScenes.clear();
      this.#appendedScenesPendingStart.clear();

      this.emit(
        "sceneDestroyed",
        this.#currentScene
      );
      this.#currentScene.destroy();

      const allActors = Array.from(
        this.#registeredActors
      );
      for (const actor of allActors) {
        this.destroyActor(actor);
      }

      this.componentsToBeStarted.length = 0;
      this.componentsToBeDestroyed.length = 0;

      this.default.clear();
      this.#registeredActors.clear();
      this.#actorsByName.clear();
    }

    this.#logger.info("Scene changed", {
      scene: scene.name
    });

    scene.world = this.#world!;
    this.#currentScene = scene;

    scene.awake();
    this.awake();

    this.#sceneStartPending = true;
    this.emit("sceneChanged", scene);
  }

  loadScene(
    scene: Scene<TContext>,
    options: SceneLoadOptions = {}
  ): SceneLoad<TContext> {
    this.#sceneLoad?.cancel();

    const controller = this.#createSceneLoad(
      scene,
      options,
      (load) => this.#handleReplacementLoadChange(load)
    );
    this.#sceneLoad = controller.load;
    this.#sceneLoadController = controller;
    this.emit(
      "sceneLoadRequested",
      controller.load
    );
    this.#startSceneLoad(controller);

    return controller.load;
  }

  #handleReplacementLoadChange(
    load: SceneLoad<TContext>
  ): void {
    this.emit(
      "sceneLoadChanged",
      load
    );

    if (load !== this.#sceneLoad) {
      return;
    }

    if (
      load.status === "ready" &&
      load.activationAllowed
    ) {
      this.#pendingScene = load.scene;
      this.#pendingSceneLoadController = this.#sceneLoadController;
    }
    else if (
      load.status === "failed" ||
      load.status === "cancelled"
    ) {
      this.#pendingScene = null;
      this.#pendingSceneLoadController = null;
    }
  }

  appendScene(
    scene: Scene<TContext>,
    options: SceneLoadOptions = {}
  ): SceneLoad<TContext> {
    this.#appendedSceneLoads.get(scene.id)?.load.cancel();

    const controller = this.#createSceneLoad(
      scene,
      options,
      (load) => this.#handleAppendedLoadChange(load)
    );
    this.#appendedSceneLoads.set(
      scene.id,
      controller
    );
    this.emit(
      "sceneLoadRequested",
      controller.load
    );
    this.#startSceneLoad(controller);

    return controller.load;
  }

  #handleAppendedLoadChange(
    load: SceneLoad<TContext>
  ): void {
    this.emit(
      "sceneLoadChanged",
      load
    );

    const controller = this.#appendedSceneLoads.get(load.scene.id);
    if (controller?.load !== load) {
      return;
    }

    if (
      load.status === "ready" &&
      load.activationAllowed
    ) {
      this.#pendingAppendedSceneLoads.set(
        load.scene.id,
        controller
      );
    }
    else if (
      load.status === "failed" ||
      load.status === "cancelled"
    ) {
      this.#pendingAppendedSceneLoads.delete(load.scene.id);
      this.#appendedSceneLoads.delete(load.scene.id);
    }
  }

  #activateAppendedScene(
    scene: Scene<TContext>
  ): void {
    this.#logger.debug(
      "Appending scene",
      { scene: scene.name }
    );

    const snapshot = new Set(this.#registeredActors);

    scene.world = this.#world!;
    scene.awake();

    const ownedActors = new Set<Actor<TContext>>();
    for (const actor of this.#registeredActors) {
      if (!snapshot.has(actor)) {
        ownedActors.add(actor);
      }
    }

    // Awaken any actors created during awake() that haven't been woken yet
    this.awake();

    this.#appendedScenes.set(
      scene.id,
      { scene, ownedActors }
    );
    this.#appendedScenesPendingStart.add(scene.id);

    this.emit(
      "sceneAppended",
      scene
    );
  }

  #createSceneLoad(
    scene: Scene<TContext>,
    options: SceneLoadOptions,
    onChange: (load: SceneLoad<TContext>) => void
  ): SceneLoadController<TContext> {
    const load = new ManagedSceneLoad(
      scene,
      options,
      onChange
    );

    return new SceneLoadController(load);
  }

  #startSceneLoad(
    controller: SceneLoadController<TContext>
  ): void {
    const { scene } = controller.load;
    if (this.#sceneLoader === null) {
      controller.start(0, scene.assets.length);
      if (scene.assets.length === 0) {
        controller.ready();
      }
      else {
        controller.fail(
          new Error("No scene loader is configured.")
        );
      }

      return;
    }

    try {
      this.#sceneLoader.load(controller);
    }
    catch (value: unknown) {
      controller.fail(toError(value));
    }
  }

  #cancelAppendedSceneLoads(): void {
    for (const controller of this.#appendedSceneLoads.values()) {
      controller.load.cancel();
    }
    this.#appendedSceneLoads.clear();
    this.#pendingAppendedSceneLoads.clear();
  }

  removeScene(scene: Scene<TContext>): void;
  removeScene(name: string): void;
  removeScene(
    target: Scene<TContext> | string
  ): void {
    if (typeof target === "string") {
      for (const controller of this.#appendedSceneLoads.values()) {
        if (controller.load.scene.name === target) {
          controller.load.cancel();
        }
      }

      for (const [id, entry] of this.#appendedScenes) {
        if (entry.scene.name === target) {
          this.#teardownAppendedScene(id, entry);
        }
      }
    }
    else {
      this.#appendedSceneLoads.get(target.id)?.load.cancel();

      const entry = this.#appendedScenes.get(target.id);
      if (entry !== undefined) {
        this.#teardownAppendedScene(target.id, entry);
      }
    }
  }

  #teardownAppendedScene(
    id: number,
    entry: AppendedSceneEntry<TContext>
  ): void {
    this.#logger.debug("Removing appended scene", {
      scene: entry.scene.name
    });

    this.emit(
      "sceneRemoved",
      entry.scene
    );
    entry.scene.destroy();

    // Destroy only root-level owned actors; destroyActor cascades to children
    for (const actor of entry.ownedActors) {
      if (
        actor.parent === null ||
        !entry.ownedActors.has(actor.parent)
      ) {
        this.destroyActor(actor);
      }
    }

    this.#appendedScenes.delete(id);
    this.#appendedScenesPendingStart.delete(id);
  }

  getScene(): Scene<TContext> | null;
  getScene(id: number): Scene<TContext> | null;
  getScene(name: string): Scene<TContext>[];
  getScene(
    target?: number | string
  ): Scene<TContext> | null | Scene<TContext>[] {
    if (target === undefined) {
      return this.#currentScene;
    }

    if (typeof target === "number") {
      return this.#appendedScenes.get(target)?.scene ?? null;
    }

    const result: Scene<TContext>[] = [];
    for (const entry of this.#appendedScenes.values()) {
      if (entry.scene.name === target) {
        result.push(entry.scene);
      }
    }

    return result;
  }

  beginFrame() {
    if (this.#pendingScene !== null) {
      this.#activateScene(this.#pendingScene);
      this.#pendingSceneLoadController?.activate();
      this.#pendingScene = null;
      this.#pendingSceneLoadController = null;
    }
    else if (this.#pendingAppendedSceneLoads.size > 0) {
      const pendingLoads = [
        ...this.#pendingAppendedSceneLoads.values()
      ];
      this.#pendingAppendedSceneLoads.clear();

      for (const controller of pendingLoads) {
        const { load } = controller;
        if (
          load.status !== "ready" ||
          !load.activationAllowed
        ) {
          continue;
        }

        this.#activateAppendedScene(load.scene);
        controller.activate();
        this.#appendedSceneLoads.delete(load.scene.id);
      }
    }

    if (this.#sceneStartPending) {
      this.#currentScene?.start();
      this.#sceneStartPending = false;
    }

    if (this.#appendedScenesPendingStart.size > 0) {
      for (const id of this.#appendedScenesPendingStart) {
        this.#appendedScenes.get(id)?.scene.start();
      }
      this.#appendedScenesPendingStart.clear();
    }

    this.#cachedActors = Array.from(this.#registeredActors);

    let i = 0;
    while (i < this.componentsToBeStarted.length) {
      const component = this.componentsToBeStarted[i];

      // If the component to be started is part of an actor
      // which will not be updated, skip it until next loop
      if (!this.#registeredActors.has(component.actor)) {
        i++;
        continue;
      }

      component.start?.();
      this.componentsToBeStarted.splice(i, 1);
    }
  }

  fixedUpdate(
    deltaTime: number
  ) {
    this.#cachedActors.forEach((actor) => {
      actor.fixedUpdate(deltaTime);
    });
    this.#currentScene?.fixedUpdate(deltaTime);

    for (const { scene } of this.#appendedScenes.values()) {
      scene.fixedUpdate(deltaTime);
    }
  }

  update(
    deltaTime: number
  ) {
    this.#cachedActors.forEach((actor) => {
      actor.update(deltaTime);
    });
    this.#currentScene?.update(deltaTime);

    for (const { scene } of this.#appendedScenes.values()) {
      scene.update(deltaTime);
    }
  }

  endFrame() {
    this.componentsToBeDestroyed.forEach((component) => {
      component.destroy();
    });
    this.componentsToBeDestroyed.length = 0;

    const actorToBeDestroyed: Actor<TContext>[] = [];
    this.#cachedActors.forEach((actor) => {
      if (actor.pendingForDestruction || actor.isDestroyed()) {
        actorToBeDestroyed.push(actor);
      }
    });

    actorToBeDestroyed.forEach((actor) => {
      this.destroyActor(actor);
    });
  }

  destroyActor(
    actor: Actor<TContext>
  ) {
    const childrenToDestroy = [...actor.children];

    childrenToDestroy.forEach((child) => {
      this.destroyActor(child);
    });

    this.unregisterActor(actor);

    // For root actors (parent === null): removes from tree.children and fires
    // the removeCallback that detaches actor.object3D from the THREE.Scene.
    // For non-root actors this is a no-op; actor.destroy() handles removal
    // from the parent's children list via parent.remove(this).
    this.tree.remove(actor);
    actor.destroy();
  }

  registerActor(
    actor: Actor<TContext>
  ) {
    this.#registeredActors.add(actor);

    const actors = this.#actorsByName.get(actor.name);
    if (actors) {
      actors.push(actor);
    }
    else {
      this.#actorsByName.set(actor.name, [actor]);
    }
  }

  unregisterActor(
    actor: Actor<TContext>
  ) {
    this.#registeredActors.delete(actor);

    const actors = this.#actorsByName.get(actor.name);
    if (actors) {
      const index = actors.indexOf(actor);
      if (index !== -1) {
        actors.splice(index, 1);
      }
      if (actors.length === 0) {
        this.#actorsByName.delete(actor.name);
      }
    }
  }

  getActor(
    name: string
  ): Actor<TContext> | null {
    const actors = this.#actorsByName.get(name);
    if (!actors) {
      return null;
    }

    for (const actor of actors) {
      if (!actor.pendingForDestruction) {
        return actor;
      }
    }

    return null;
  }

  destroyComponent(
    component: ActorComponent<TContext>
  ) {
    if (component.pendingForDestruction) {
      return;
    }

    this.componentsToBeDestroyed.push(component);
    component.pendingForDestruction = true;

    const index = this.componentsToBeStarted.indexOf(component);
    if (index !== -1) {
      this.componentsToBeStarted.splice(index, 1);
    }
  }
}

function toError(
  value: unknown
): Error {
  return value instanceof Error ? value : new Error(String(value));
}
