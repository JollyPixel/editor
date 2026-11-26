// Import Third-party Dependencies
import {
  OverrideChange,
  ownedCopy,
  type OverrideGroup,
  type SceneDocument,
  type SceneOverridesJSON
} from "@jolly-pixel/asset.scene/client";
import { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import type { SceneAccess } from "../access/SceneAccess.ts";
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
  prefabs: Pick<PrefabScenes, "prefab" | "subscribe">;
  access: Pick<SceneAccess, "can">;
}

type PrefabApply = () => (OverrideChange | null)[];

export class InstanceOverrides {
  #document: SceneDocument;
  #history: Pick<SceneHistory, "record">;
  #live: Pick<SceneLiveView, "expandedActor">;
  #prefabs: Pick<PrefabScenes, "prefab" | "subscribe">;
  #access: Pick<SceneAccess, "can">;

  constructor(
    options: InstanceOverridesOptions
  ) {
    this.#document = options.document;
    this.#history = options.history;
    this.#live = options.live;
    this.#prefabs = options.prefabs;
    this.#access = options.access;
  }

  canApplyToPrefab(
    instanceId: string
  ): boolean {
    return this.#prefabApply(instanceId) !== null;
  }

  subscribe(
    listener: () => void
  ): () => void {
    return this.#prefabs.subscribe("accessChange", listener);
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
    const apply = this.#prefabApply(instanceId);
    if (apply !== null) {
      this.#commit("Apply to prefab", apply());
    }
  }

  #prefabApply(
    instanceId: string
  ): PrefabApply | null {
    const instance = this.#document.tree.actor(instanceId);
    const prefab = instance?.prefab === undefined ?
      null :
      this.#prefabs.prefab(instance.prefab.id);
    if (
      !this.#access.can("instances") ||
      instance === undefined ||
      prefab === null
    ) {
      return null;
    }

    const { document } = prefab;
    const writes = new ActorWrites(document, prefab.access);
    const { actors = {}, components = {} } = ownedCopy<SceneOverridesJSON>(instance.overrides ?? {});
    const writable = Object.entries(actors).every(([path, entry]) => (
      !reaches(document, "actors", path) || writes.canWriteActor(path, entry)
    )) && Object.keys(components).every((path) => (
      !reaches(document, "components", path) || writes.canWriteComponent(path)
    ));
    if (!writable) {
      return null;
    }

    return () => [
      ...Object.entries(actors).map(([path, entry]) => (
        !reaches(document, "actors", path) || writes.writeActor(path, entry) ?
          OverrideChange.clear(instance, "actors", path) :
          null
      )),
      ...Object.entries(components).map(([path, entry]) => (
        !reaches(document, "components", path) || writes.writeComponent(path, entry) ?
          OverrideChange.clear(instance, "components", path) :
          null
      ))
    ];
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
    if (!this.#access.can("instances") || committed.length === 0) {
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
