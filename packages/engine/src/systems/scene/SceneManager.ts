// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  type Actor,
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
   *
   */
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

type SceneLoadMode = "replace" | "append";

/**
 * Owns scene loading state and applies changes at frame boundaries.
 */
export class SceneManager<
  TContext = WorldDefaultContext
> extends Emitter<SceneEvents<TContext>> {
  default: THREE.Scene;

  #componentsToStart: Component[] = [];
  #componentsToDestroy: Component[] = [];

  #registeredActors: Set<Actor<TContext>> = new Set();
  #cachedActors: Actor<TContext>[] = [];
  #hasActorsToAwake = false;

  #currentScene: Scene<TContext> | null = null;
  #sceneStartPending = false;
  #sceneLoader: SceneLoader<TContext> | null = null;
  #world: World<any, TContext> | null = null;
  #logger!: Logger;

  #replacementLoad: ManagedSceneLoad<TContext> | null = null;
  #appendLoads: Map<number, ManagedSceneLoad<TContext>> = new Map();
  #readyLoads: Set<ManagedSceneLoad<TContext>> = new Set();

  #appendedScenes: Map<number, AppendedSceneEntry<TContext>> = new Map();
  #appendedScenesPendingStart: Set<number> = new Set();

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
    return this.#replacementLoad !== null &&
      this.#readyLoads.has(this.#replacementLoad);
  }

  get sceneLoad(): SceneLoad<TContext> | null {
    return this.#replacementLoad;
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
    this.#awakeActors();
    this.emit("awake");
  }

  #awakeActors(): void {
    this.#hasActorsToAwake = false;
    for (const { actor } of this.tree.walk()) {
      if (!actor.awoken) {
        actor.awake();
      }
    }
  }

  loadScene(
    scene: Scene<TContext>,
    options: SceneLoadOptions = {}
  ): SceneLoad<TContext> {
    this.#replacementLoad?.cancel();

    const load = this.#createSceneLoad(scene, options, "replace");
    this.#replacementLoad = load;
    this.emit("sceneLoadRequested", load);
    this.#startSceneLoad(load);

    return load;
  }

  appendScene(
    scene: Scene<TContext>,
    options: SceneLoadOptions = {}
  ): SceneLoad<TContext> {
    this.#appendLoads.get(scene.id)?.cancel();

    const load = this.#createSceneLoad(scene, options, "append");
    this.#appendLoads.set(scene.id, load);
    this.emit("sceneLoadRequested", load);
    this.#startSceneLoad(load);

    return load;
  }

  #createSceneLoad(
    scene: Scene<TContext>,
    options: SceneLoadOptions,
    mode: SceneLoadMode
  ): ManagedSceneLoad<TContext> {
    return new ManagedSceneLoad(
      scene,
      options,
      (load) => this.#handleLoadChange(load, mode)
    );
  }

  #isTracked(
    load: ManagedSceneLoad<TContext>,
    mode: SceneLoadMode
  ): boolean {
    return mode === "replace" ?
      this.#replacementLoad === load :
      this.#appendLoads.get(load.scene.id) === load;
  }

  #handleLoadChange(
    load: ManagedSceneLoad<TContext>,
    mode: SceneLoadMode
  ): void {
    this.emit("sceneLoadChanged", load);

    if (!this.#isTracked(load, mode)) {
      return;
    }

    if (load.status === "ready" && load.activationAllowed) {
      this.#readyLoads.add(load);
    }
    else if (load.status === "failed" || load.status === "cancelled") {
      this.#readyLoads.delete(load);
      if (mode === "append") {
        this.#appendLoads.delete(load.scene.id);
      }
    }
  }

  #startSceneLoad(
    load: ManagedSceneLoad<TContext>
  ): void {
    const { scene } = load;
    if (this.#sceneLoader === null) {
      load.start(0, scene.assets.length);
      if (scene.assets.length === 0) {
        load.ready();
      }
      else {
        load.fail(
          new Error("No scene loader is configured.")
        );
      }

      return;
    }

    try {
      this.#sceneLoader.load(load);
    }
    catch (value: unknown) {
      load.fail(toError(value));
    }
  }

  #activateScene(
    scene: Scene<TContext>
  ): void {
    for (const load of [...this.#appendLoads.values()]) {
      load.cancel();
    }

    if (this.#currentScene !== null) {
      this.#teardownCurrentScene(this.#currentScene);
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

  #teardownCurrentScene(
    scene: Scene<TContext>
  ): void {
    this.#logger.debug("Tearing down current scene", {
      scene: scene.name
    });

    for (const entry of this.#appendedScenes.values()) {
      this.emit("sceneRemoved", entry.scene);
      entry.scene.destroy();
    }
    this.#appendedScenes.clear();
    this.#appendedScenesPendingStart.clear();

    this.emit("sceneDestroyed", scene);
    scene.destroy();

    for (const actor of [...this.tree.children]) {
      actor.destroy();
    }

    this.#componentsToStart.length = 0;
    this.#componentsToDestroy.length = 0;
    this.default.clear();
    this.#registeredActors.clear();
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

    this.#awakeActors();

    this.#appendedScenes.set(
      scene.id,
      { scene, ownedActors }
    );
    this.#appendedScenesPendingStart.add(scene.id);

    this.emit("sceneAppended", scene);
  }

  removeScene(scene: Scene<TContext>): void;
  removeScene(name: string): void;
  removeScene(
    target: Scene<TContext> | string
  ): void {
    const matches = typeof target === "string" ?
      (scene: Scene<TContext>) => scene.name === target :
      (scene: Scene<TContext>) => scene === target;

    for (const load of [...this.#appendLoads.values()]) {
      if (matches(load.scene)) {
        load.cancel();
      }
    }

    for (const [id, entry] of this.#appendedScenes) {
      if (matches(entry.scene)) {
        this.#teardownAppendedScene(id, entry);
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

    this.emit("sceneRemoved", entry.scene);
    entry.scene.destroy();

    for (const actor of entry.ownedActors) {
      if (
        actor.parent === null ||
        !entry.ownedActors.has(actor.parent)
      ) {
        actor.destroy();
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
    this.#activateReadyLoads();

    if (this.#hasActorsToAwake) {
      this.#awakeActors();
    }

    if (this.#sceneStartPending) {
      this.#sceneStartPending = false;
      this.#currentScene?.start();
    }

    for (const id of this.#appendedScenesPendingStart) {
      this.#appendedScenes.get(id)?.scene.start();
    }
    this.#appendedScenesPendingStart.clear();

    this.#cachedActors = Array.from(this.#registeredActors);
    this.#startComponents();
  }

  #activateReadyLoads(): void {
    const replacement = this.#replacementLoad;
    if (replacement !== null && this.#readyLoads.delete(replacement)) {
      this.#activateScene(replacement.scene);
      replacement.activate();

      return;
    }

    const readyLoads = [...this.#readyLoads];
    this.#readyLoads.clear();

    for (const load of readyLoads) {
      this.#activateAppendedScene(load.scene);
      load.activate();
      this.#appendLoads.delete(load.scene.id);
    }
  }

  #startComponents(): void {
    const components = this.#componentsToStart;
    let i = 0;
    while (i < components.length) {
      const component = components[i];
      if (this.#registeredActors.has(component.actor)) {
        components.splice(i, 1);
        component.start?.();
      }
      else {
        i++;
      }
    }
  }

  fixedUpdate(
    deltaTime: number,
    stepIndex = 0
  ) {
    for (const actor of this.#cachedActors) {
      actor.fixedUpdate(deltaTime, stepIndex);
    }
    this.#currentScene?.fixedUpdate(deltaTime, stepIndex);

    for (const { scene } of this.#appendedScenes.values()) {
      scene.fixedUpdate(deltaTime, stepIndex);
    }
  }

  update(
    deltaTime: number,
    alpha = 0
  ) {
    for (const actor of this.#cachedActors) {
      actor.update(deltaTime, alpha);
    }
    this.#currentScene?.update(deltaTime, alpha);

    for (const { scene } of this.#appendedScenes.values()) {
      scene.update(deltaTime, alpha);
    }
  }

  endFrame() {
    for (const component of this.#componentsToDestroy.splice(0)) {
      component.destroy();
    }

    for (const actor of this.#cachedActors) {
      if (
        actor.pendingForDestruction &&
        this.#registeredActors.has(actor) &&
        !actor.parent?.pendingForDestruction
      ) {
        actor.destroy();
      }
    }
  }

  registerActor(
    actor: Actor<TContext>
  ) {
    this.#registeredActors.add(actor);
    this.#hasActorsToAwake = true;
  }

  unregisterActor(
    actor: Actor<TContext>
  ) {
    this.#registeredActors.delete(actor);
  }

  getActor(
    name: string
  ): Actor<TContext> | null {
    return this.tree.getActor(name);
  }

  scheduleStart(
    component: Component
  ): void {
    this.#componentsToStart.push(component);
  }

  cancelStart(
    component: Component
  ): void {
    const index = this.#componentsToStart.indexOf(component);
    if (index !== -1) {
      this.#componentsToStart.splice(index, 1);
    }
  }

  destroyComponent(
    component: Component
  ) {
    if (component.pendingForDestruction) {
      return;
    }

    component.pendingForDestruction = true;
    this.#componentsToDestroy.push(component);
    this.cancelStart(component);
  }
}

function toError(
  value: unknown
): Error {
  return value instanceof Error ? value : new Error(String(value));
}
