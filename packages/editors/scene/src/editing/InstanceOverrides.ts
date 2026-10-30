// Import Third-party Dependencies
import {
  OverrideChange,
  ownedCopy,
  type OverrideGroup,
  type SceneDocument,
  type SceneOverridesJSON
} from "@jolly-pixel/asset.scene/client";
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { ActorWrites } from "./ActorWrites.ts";
import {
  SCENE_HISTORY_SCOPE,
  type SceneHistory
} from "../features/history/sceneHistory.ts";
import type { PrefabScenes } from "../scene/PrefabScenes.ts";
import type { SceneLiveView } from "./SceneEditing.ts";

export type ActorRole = "own" | "instance" | "inner";

export interface InstanceOverridesOptions {
  document: SceneDocument;
  history: Pick<SceneHistory, "record">;
  live: Pick<SceneLiveView, "expandedActor">;
  prefabs: Pick<PrefabScenes, "document">;
}

export class InstanceOverrides {
  #document: SceneDocument;
  #history: Pick<SceneHistory, "record">;
  #live: Pick<SceneLiveView, "expandedActor">;
  #prefabs: Pick<PrefabScenes, "document">;

  constructor(
    options: InstanceOverridesOptions
  ) {
    this.#document = options.document;
    this.#history = options.history;
    this.#live = options.live;
    this.#prefabs = options.prefabs;
  }

  role(
    id: string
  ): ActorRole {
    if (Systems.InstancePath.parse(id) !== null) {
      return "inner";
    }

    return this.#document.tree.actor(id)?.prefab === undefined ? "own" : "instance";
  }

  exists(
    id: string
  ): boolean {
    return this.#document.tree.has(id) || this.#live.expandedActor(id) !== null;
  }

  actorOverridden(
    id: string
  ): boolean {
    return this.#actorClears(id).length > 0;
  }

  componentOverridden(
    id: string
  ): boolean {
    return this.#componentClear(id) !== null;
  }

  revertActor(
    id: string
  ): void {
    this.#commit("Revert overrides", this.#actorClears(id));
  }

  revertComponent(
    id: string
  ): void {
    this.#commit("Revert overrides", [this.#componentClear(id)]);
  }

  applyToPrefab(
    instanceId: string
  ): void {
    const instance = this.#document.tree.actor(instanceId);
    const prefab = instance?.prefab === undefined ?
      null :
      this.#prefabs.document(instance.prefab.id);
    if (instance === undefined || prefab === null) {
      return;
    }

    const { actors = {}, components = {} } = ownedCopy<SceneOverridesJSON>(instance.overrides ?? {});
    const writes = new ActorWrites(prefab);
    const applied: (OverrideChange | null)[] = [];
    for (const [path, entry] of Object.entries(actors)) {
      if (!reaches(prefab, "actors", path) || writes.writeActor(path, entry)) {
        applied.push(OverrideChange.clear(instance, "actors", path));
      }
    }
    for (const [path, entry] of Object.entries(components)) {
      if (!reaches(prefab, "components", path) || writes.writeComponent(path, entry)) {
        applied.push(OverrideChange.clear(instance, "components", path));
      }
    }
    this.#commit("Apply to prefab", applied);
  }

  #actorClears(
    id: string
  ): OverrideChange[] {
    const target = Systems.InstancePath.parse(id);
    const instance = this.#document.tree.actor(target?.instanceId ?? id);
    if (instance === undefined) {
      return [];
    }
    if (target === null) {
      return [
        ...Object.keys(instance.overrides?.actors ?? {}).map(
          (path) => OverrideChange.clear(instance, "actors", path)
        ),
        ...Object.keys(instance.overrides?.components ?? {}).map(
          (path) => OverrideChange.clear(instance, "components", path)
        )
      ].filter((clear) => clear !== null);
    }

    const actor = this.#live.expandedActor(id);

    return [
      OverrideChange.clear(instance, "actors", target.path),
      ...(actor?.components ?? []).map(({ id: componentId }) => this.#componentClear(componentId))
    ].filter((clear) => clear !== null);
  }

  #componentClear(
    id: string
  ): OverrideChange | null {
    const target = Systems.InstancePath.parse(id);
    const instance = target === null ? undefined : this.#document.tree.actor(target.instanceId);

    return target === null || instance === undefined ?
      null :
      OverrideChange.clear(instance, "components", target.path);
  }

  #commit(
    label: string,
    changes: readonly (OverrideChange | null)[]
  ): void {
    const committed = changes.filter((change) => change !== null);
    if (committed.length === 0) {
      return;
    }

    this.#history.record(SCENE_HISTORY_SCOPE, label, () => {
      for (const change of committed) {
        this.#document.override(change);
      }
    });
  }
}

function reaches(
  prefab: SceneDocument,
  group: OverrideGroup,
  path: string
): boolean {
  const nested = Systems.InstancePath.parse(path);
  if (nested !== null) {
    return prefab.tree.actor(nested.instanceId)?.prefab !== undefined;
  }

  return group === "actors" ?
    prefab.tree.has(path) :
    prefab.tree.component(path) !== undefined;
}
