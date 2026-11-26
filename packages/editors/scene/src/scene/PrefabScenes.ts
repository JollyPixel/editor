// Import Third-party Dependencies
import {
  ownedCopy,
  type SceneDocument
} from "@jolly-pixel/asset.scene/client";
import type { AssetLease } from "@jolly-pixel/editor.host";
import type { Systems } from "@jolly-pixel/ecs";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { SceneAccess } from "../access/SceneAccess.ts";

export interface SceneLease extends Pick<
  AssetLease<SceneDocument>,
  "document" | "ready" | "release"
> {
  readonly access: Pick<SceneAccess, "can" | "subscribe">;
}

export type PrefabLease = Pick<SceneLease, "document" | "access">;

export type SceneLeaser = (sceneId: string) => SceneLease;

export type PrefabScenesEvents = {
  change: (sceneId: string) => void;
  accessChange: () => void;
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
  #retained = new Set<string>();
  #releasing = false;

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
      { actors: ownedCopy([...scene.lease.document.tree.actors()]) };
  }

  prefab(
    sceneId: string
  ): PrefabLease | null {
    return this.#scenes.get(sceneId)?.lease ?? null;
  }

  retain(
    sceneIds: Iterable<string>
  ): void {
    this.#retained = new Set(sceneIds);
    if (this.#releasing) {
      return;
    }

    this.#releasing = true;
    queueMicrotask(() => {
      this.#releasing = false;
      for (const [sceneId, { lease, unsubscribe }] of this.#scenes) {
        if (!this.#retained.has(sceneId)) {
          this.#scenes.delete(sceneId);
          unsubscribe();
          lease.release();
        }
      }
    });
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
      lease.document.subscribe("reset", changed),
      lease.access.subscribe(() => {
        if (this.#scenes.get(sceneId)?.lease === lease) {
          this.emit("accessChange");
        }
      })
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
