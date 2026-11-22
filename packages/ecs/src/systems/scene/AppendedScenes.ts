// Import Internal Dependencies
import type {
  World,
  WorldDefaultContext
} from "../World.ts";
import type { Scene } from "./Scene.ts";
import type { ManagedSceneLoad } from "./ManagedSceneLoad.ts";
import type { ActorRegistry } from "./ActorRegistry.ts";

export class AppendedScenes<
  TContext = WorldDefaultContext
> {
  #actors: ActorRegistry<TContext>;
  #onRemoved: (scene: Scene<TContext>) => void;
  #loads = new Map<number, ManagedSceneLoad<TContext>>();
  #scenes = new Map<number, Scene<TContext>>();
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

  cancelLoads(): void {
    const loads = [...this.#loads.values()];
    this.#loads.clear();
    for (const load of loads) {
      load.cancel();
    }
  }

  takeActivatable(): ManagedSceneLoad<TContext>[] {
    const activatable: ManagedSceneLoad<TContext>[] = [];
    for (const [id, load] of this.#loads) {
      if (load.activatable) {
        activatable.push(load);
        this.#loads.delete(id);
      }
      else if (load.status === "failed" || load.status === "cancelled") {
        this.#loads.delete(id);
      }
    }

    return activatable;
  }

  activate(
    scene: Scene<TContext>,
    world: World<any, TContext>
  ): void {
    scene.world = world;
    this.#actors.ownedBy(scene, () => {
      scene.awake();
      this.#actors.awake();
    });

    this.#scenes.set(scene.id, scene);
    this.#pendingStart.add(scene.id);
  }

  startPending(): void {
    for (const id of this.#pendingStart) {
      const scene = this.#scenes.get(id);
      if (scene !== undefined) {
        this.#actors.ownedBy(scene, () => scene.start());
      }
    }
    this.#pendingStart.clear();
  }

  fixedUpdate(
    deltaTime: number,
    stepIndex: number
  ): void {
    for (const scene of this.#scenes.values()) {
      this.#actors.ownedBy(
        scene,
        () => scene.fixedUpdate(deltaTime, stepIndex)
      );
    }
  }

  update(
    deltaTime: number,
    alpha: number
  ): void {
    for (const scene of this.#scenes.values()) {
      this.#actors.ownedBy(
        scene,
        () => scene.update(deltaTime, alpha)
      );
    }
  }

  find(
    id: number
  ): Scene<TContext> | null {
    return this.#scenes.get(id) ?? null;
  }

  * named(
    name: string
  ): IterableIterator<Scene<TContext>> {
    for (const scene of this.#scenes.values()) {
      if (scene.name === name) {
        yield scene;
      }
    }
  }

  remove(
    matches: (scene: Scene<TContext>) => boolean
  ): void {
    for (const [id, load] of this.#loads) {
      if (matches(load.scene)) {
        this.#loads.delete(id);
        load.cancel();
      }
    }

    for (const [id, scene] of this.#scenes) {
      if (matches(scene)) {
        this.#onRemoved(scene);
        scene.destroy();
        this.#actors.destroyOwned(scene);
        this.#forget(id);
      }
    }
  }

  clear(): void {
    for (const [id, scene] of this.#scenes) {
      this.#onRemoved(scene);
      scene.destroy();
      this.#forget(id);
    }
  }

  #forget(
    id: number
  ): void {
    this.#scenes.delete(id);
    this.#pendingStart.delete(id);
  }
}
