// Import Third-party Dependencies
import type { SceneDocument } from "@jolly-pixel/asset.scene/client";
import type { AssetLease } from "@jolly-pixel/editor.host";
import type { Systems } from "@jolly-pixel/engine";
import { Emitter } from "@openally/emitt";

export type SceneLease = Pick<
  AssetLease<SceneDocument>,
  "document" | "ready" | "release"
>;

export type SceneLeaser = (sceneId: string) => SceneLease;

export type PrefabScenesEvents = {
  change: (sceneId: string) => void;
};

interface LeasedScene {
  lease: SceneLease;
  unsubscribe: () => void;
}

export class PrefabScenes
  extends Emitter<PrefabScenesEvents>
  implements Systems.ScenePrefabs {
  #open: SceneLeaser;
  #scenes = new Map<string, LeasedScene>();

  constructor(
    open: SceneLeaser
  ) {
    super();
    this.#open = open;
  }

  find(
    sceneId: string
  ): Systems.ScenePrefabFile | null {
    const scene = this.#scenes.get(sceneId) ?? this.#lease(sceneId);

    return scene === null ?
      null :
      { actors: [...scene.lease.document.tree.actors()] };
  }

  dispose(): void {
    for (const { lease, unsubscribe } of this.#scenes.values()) {
      unsubscribe();
      lease.release();
    }
    this.#scenes.clear();
  }

  #lease(
    sceneId: string
  ): LeasedScene | null {
    let lease: SceneLease;
    try {
      lease = this.#open(sceneId);
    }
    catch {
      return null;
    }

    const changed = (): void => {
      if (this.#scenes.get(sceneId)?.lease === lease) {
        this.emit("change", sceneId);
      }
    };
    const unsubscribers = [
      lease.document.subscribe("change", changed),
      lease.document.subscribe("reset", changed)
    ];
    lease.ready.then(changed, () => undefined);

    const scene = {
      lease,
      unsubscribe: () => {
        for (const unsubscribe of unsubscribers) {
          unsubscribe();
        }
      }
    };
    this.#scenes.set(sceneId, scene);

    return scene;
  }
}
