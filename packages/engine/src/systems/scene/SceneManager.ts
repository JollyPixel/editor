// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { Actor } from "../../actor/index.ts";
import type {
  World,
  WorldDefaultContext
} from "../World.ts";
import type { Scene } from "./Scene.ts";
import type { Logger } from "../Logger.ts";
import { ManagedSceneLoad } from "./ManagedSceneLoad.ts";
import { ActorRegistry } from "./ActorRegistry.ts";
import type {
  SceneLoad,
  SceneLoadOptions
} from "./SceneLoad.ts";

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

export class SceneManager<
  TContext = WorldDefaultContext
> extends Emitter<SceneEvents<TContext>> {
  readonly default: THREE.Scene;
  readonly actors: ActorRegistry<TContext>;

  #currentScene: Scene<TContext> | null = null;
  #sceneStartPending = false;
  #world: World<any, TContext> | null = null;
  #logger!: Logger;

  #replacementLoad: ManagedSceneLoad<TContext> | null = null;
  #appendLoads: Map<number, ManagedSceneLoad<TContext>> = new Map();
  #readyLoads: Set<ManagedSceneLoad<TContext>> = new Set();

  #appendedScenes: Map<number, AppendedSceneEntry<TContext>> = new Map();
  #appendedScenesPendingStart: Set<number> = new Set();

  constructor(
    scene?: THREE.Scene
  ) {
    super();
    this.default = scene ?? new THREE.Scene();
    this.actors = new ActorRegistry(this.default);
  }

  get tree() {
    return this.actors.tree;
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

  awake() {
    this.actors.awake();
    this.emit("awake");
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
    try {
      const batch = this.#world!.assetCoordinator.loadBatch(
        load.scene.assets,
        {
          onProgress: (progress) => load.report(progress)
        }
      );
      load.start(batch.completed, batch.total);

      if (batch.status === "ready") {
        load.ready();
      }
      else {
        void batch.done.then(
          () => load.ready(),
          (value: unknown) => load.fail(toError(value))
        );
      }
    }
    catch (value: unknown) {
      load.fail(toError(value));
    }
  }

  #activateScene(
    scene: Scene<TContext>
  ): void {
    this.#cancelAppendLoads();

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

  #cancelAppendLoads(): void {
    for (const load of [...this.#appendLoads.values()]) {
      load.cancel();
    }
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

    this.actors.clear();
    this.default.clear();
  }

  #activateAppendedScene(
    scene: Scene<TContext>
  ): void {
    this.#logger.debug(
      "Appending scene",
      { scene: scene.name }
    );

    scene.world = this.#world!;
    const ownedActors = this.actors.collect(() => scene.awake());
    this.actors.awake();

    this.#appendedScenes.set(
      scene.id,
      { scene, ownedActors }
    );
    this.#appendedScenesPendingStart.add(scene.id);

    this.emit("sceneAppended", scene);
  }

  unloadScene(
    scene: Scene<TContext>
  ): void {
    if (this.#replacementLoad?.scene === scene) {
      this.#replacementLoad.cancel();
    }
    if (this.#currentScene !== scene) {
      return;
    }

    this.#cancelAppendLoads();
    this.#teardownCurrentScene(scene);
    this.#currentScene = null;
    this.#sceneStartPending = false;
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

    this.actors.destroyRoots(entry.ownedActors);

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

    if (this.#sceneStartPending) {
      this.#sceneStartPending = false;
      this.#currentScene?.start();
    }

    if (this.#appendedScenesPendingStart.size > 0) {
      for (const id of this.#appendedScenesPendingStart) {
        this.#appendedScenes.get(id)?.scene.start();
      }
      this.#appendedScenesPendingStart.clear();
    }

    this.actors.beginFrame();
  }

  #activateReadyLoads(): void {
    if (this.#readyLoads.size === 0) {
      return;
    }

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

  fixedUpdate(
    deltaTime: number,
    stepIndex = 0
  ) {
    this.actors.fixedUpdate(deltaTime, stepIndex);
    this.#currentScene?.fixedUpdate(deltaTime, stepIndex);

    for (const { scene } of this.#appendedScenes.values()) {
      scene.fixedUpdate(deltaTime, stepIndex);
    }
  }

  update(
    deltaTime: number,
    alpha = 0
  ) {
    this.actors.update(deltaTime, alpha);
    this.#currentScene?.update(deltaTime, alpha);

    for (const { scene } of this.#appendedScenes.values()) {
      scene.update(deltaTime, alpha);
    }
  }

  endFrame() {
    this.actors.endFrame();
  }

  getActor(
    name: string
  ): Actor<TContext> | null {
    return this.tree.getActor(name);
  }
}

function toError(
  value: unknown
): Error {
  return value instanceof Error ? value : new Error(String(value));
}
