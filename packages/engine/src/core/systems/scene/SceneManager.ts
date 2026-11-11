// Import Third-party Dependencies
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
import { AppendedScenes } from "./AppendedScenes.ts";
import type {
  SceneLoad,
  SceneLoadOptions
} from "./SceneLoad.ts";
import type { SceneGraph } from "./SceneGraph.ts";
import type { BackendSceneGraph } from "../SceneBackend.ts";

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

export class SceneManager<
  TContext = WorldDefaultContext
> extends Emitter<SceneEvents<TContext>> {
  readonly graph: BackendSceneGraph;
  readonly actors: ActorRegistry<TContext>;

  #currentScene: Scene<TContext> | null = null;
  #sceneStartPending = false;
  #world: World<any, TContext> | null = null;
  #logger!: Logger;

  #replacementLoad: ManagedSceneLoad<TContext> | null = null;
  #readyLoads: Set<ManagedSceneLoad<TContext>> = new Set();
  #appended: AppendedScenes<TContext>;

  constructor(
    graph: SceneGraph
  ) {
    super();
    this.graph = graph as BackendSceneGraph;
    this.actors = new ActorRegistry(graph);
    this.#appended = new AppendedScenes(
      this.actors,
      (scene) => {
        this.#logger.debug("Removing appended scene", {
          scene: scene.name
        });
        this.emit("sceneRemoved", scene);
      }
    );
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

    const load = new ManagedSceneLoad(
      scene,
      options,
      (changed) => this.#handleLoadChange(
        changed,
        this.#replacementLoad === changed
      )
    );
    this.#replacementLoad = load;
    this.emit("sceneLoadRequested", load);
    this.#startSceneLoad(load);

    return load;
  }

  appendScene(
    scene: Scene<TContext>,
    options: SceneLoadOptions = {}
  ): SceneLoad<TContext> {
    const load = new ManagedSceneLoad(
      scene,
      options,
      (changed) => this.#handleLoadChange(
        changed,
        this.#appended.tracks(changed)
      )
    );
    this.#appended.request(load);
    this.emit("sceneLoadRequested", load);
    this.#startSceneLoad(load);

    return load;
  }

  #handleLoadChange(
    load: ManagedSceneLoad<TContext>,
    tracked: boolean
  ): void {
    this.emit("sceneLoadChanged", load);

    if (!tracked) {
      return;
    }

    if (load.status === "ready" && load.activationAllowed) {
      this.#readyLoads.add(load);
    }
    else if (load.status === "failed" || load.status === "cancelled") {
      this.#readyLoads.delete(load);
      this.#appended.forget(load);
    }
  }

  #startSceneLoad(
    load: ManagedSceneLoad<TContext>
  ): void {
    try {
      const coordinator = this.#world!.assetCoordinator;
      const batch = coordinator.loadBatch(
        load.scene.assetsToLoad(coordinator),
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
    this.#appended.cancelLoads();

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

    this.#appended.clear();

    this.emit("sceneDestroyed", scene);
    scene.destroy();

    this.actors.clear();
  }

  #activateAppendedScene(
    scene: Scene<TContext>
  ): void {
    this.#logger.debug(
      "Appending scene",
      { scene: scene.name }
    );

    this.#appended.activate(scene, this.#world!);
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

    this.#appended.cancelLoads();
    this.#teardownCurrentScene(scene);
    this.#currentScene = null;
    this.#sceneStartPending = false;
  }

  removeScene(scene: Scene<TContext>): void;
  removeScene(name: string): void;
  removeScene(
    target: Scene<TContext> | string
  ): void {
    this.#appended.remove(
      typeof target === "string" ?
        (scene) => scene.name === target :
        (scene) => scene === target
    );
  }

  findScene(
    id: number
  ): Scene<TContext> | null {
    return this.#appended.find(id);
  }

  scenesNamed(
    name: string
  ): Scene<TContext>[] {
    return [...this.#appended.named(name)];
  }

  beginFrame() {
    this.#activateReadyLoads();

    if (this.#sceneStartPending) {
      this.#sceneStartPending = false;
      this.#currentScene?.start();
    }

    this.#appended.startPending();

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
      this.#appended.forget(load);
    }
  }

  fixedUpdate(
    deltaTime: number,
    stepIndex = 0
  ) {
    this.actors.fixedUpdate(deltaTime, stepIndex);
    this.#currentScene?.fixedUpdate(deltaTime, stepIndex);
    this.#appended.fixedUpdate(deltaTime, stepIndex);
  }

  update(
    deltaTime: number,
    alpha = 0
  ) {
    this.actors.update(deltaTime, alpha);
    this.#currentScene?.update(deltaTime, alpha);
    this.#appended.update(deltaTime, alpha);
  }

  endFrame() {
    this.actors.endFrame();
  }

  findActor(
    name: string
  ): Actor<TContext> | null {
    return this.tree.findActor(name);
  }
}

function toError(
  value: unknown
): Error {
  return value instanceof Error ? value : new Error(String(value));
}
