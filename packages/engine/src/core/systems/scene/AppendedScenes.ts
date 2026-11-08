// Import Internal Dependencies
import type { Actor } from "../../actor/index.ts";
import type {
  World,
  WorldDefaultContext
} from "../World.ts";
import type { Scene } from "./Scene.ts";
import type { ManagedSceneLoad } from "./ManagedSceneLoad.ts";
import type { ActorRegistry } from "./ActorRegistry.ts";

export type AppendedSceneEntry<TContext> = {
  scene: Scene<TContext>;
  /**
   * All actors created during the scene's awake(),
   * tracked for cleanup on removeScene.
   *
   */
  ownedActors: ReadonlySet<Actor<TContext>>;
};

export type AppendedSceneMatcher<TContext> = (
  scene: Scene<TContext>
) => boolean;

export class AppendedScenes<
  TContext = WorldDefaultContext
> {
  #actors: ActorRegistry<TContext>;
  #onRemoved: (scene: Scene<TContext>) => void;
  #loads = new Map<number, ManagedSceneLoad<TContext>>();
  #entries = new Map<number, AppendedSceneEntry<TContext>>();
  #pendingStart = new Set<number>();

  constructor(
    actors: ActorRegistry<TContext>,
    onRemoved: (scene: Scene<TContext>) => void
  ) {
    this.#actors = actors;
    this.#onRemoved = onRemoved;
  }

  request(
    load: ManagedSceneLoad<TContext>
  ): void {
    this.#loads.get(load.scene.id)?.cancel();
    this.#loads.set(load.scene.id, load);
  }

  tracks(
    load: ManagedSceneLoad<TContext>
  ): boolean {
    return this.#loads.get(load.scene.id) === load;
  }

  forget(
    load: ManagedSceneLoad<TContext>
  ): void {
    if (this.tracks(load)) {
      this.#loads.delete(load.scene.id);
    }
  }

  cancelLoads(): void {
    for (const load of [...this.#loads.values()]) {
      load.cancel();
    }
  }

  activate(
    scene: Scene<TContext>,
    world: World<any, TContext>
  ): void {
    scene.world = world;
    const ownedActors = this.#actors.collect(() => scene.awake());
    this.#actors.awake();

    this.#entries.set(scene.id, {
      scene,
      ownedActors
    });
    this.#pendingStart.add(scene.id);
  }

  startPending(): void {
    for (const id of this.#pendingStart) {
      this.#entries.get(id)?.scene.start();
    }
    this.#pendingStart.clear();
  }

  fixedUpdate(
    deltaTime: number,
    stepIndex: number
  ): void {
    for (const { scene } of this.#entries.values()) {
      scene.fixedUpdate(deltaTime, stepIndex);
    }
  }

  update(
    deltaTime: number,
    alpha: number
  ): void {
    for (const { scene } of this.#entries.values()) {
      scene.update(deltaTime, alpha);
    }
  }

  find(
    id: number
  ): Scene<TContext> | null {
    return this.#entries.get(id)?.scene ?? null;
  }

  * named(
    name: string
  ): IterableIterator<Scene<TContext>> {
    for (const { scene } of this.#entries.values()) {
      if (scene.name === name) {
        yield scene;
      }
    }
  }

  remove(
    matches: AppendedSceneMatcher<TContext>
  ): void {
    for (const load of [...this.#loads.values()]) {
      if (matches(load.scene)) {
        load.cancel();
      }
    }

    for (const [id, { scene, ownedActors }] of this.#entries) {
      if (matches(scene)) {
        this.#onRemoved(scene);
        scene.destroy();
        this.#actors.destroySceneActors(ownedActors);
        this.#forget(id);
      }
    }
  }

  clear(): void {
    for (const [id, { scene }] of this.#entries) {
      this.#onRemoved(scene);
      scene.destroy();
      this.#forget(id);
    }
  }

  #forget(
    id: number
  ): void {
    this.#entries.delete(id);
    this.#pendingStart.delete(id);
  }
}
