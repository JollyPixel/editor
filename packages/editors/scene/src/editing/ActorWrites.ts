// Import Third-party Dependencies
import {
  ComponentChange,
  OverrideChange,
  type AssetReferenceJSON,
  type SceneActorOverrideJSON,
  type SceneComponentOverrideJSON,
  type SceneDocument,
  type SceneTransformPatch
} from "@jolly-pixel/asset.scene/client";
import { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import type { SceneAccess } from "../access/SceneAccess.ts";

export class ActorWrites {
  #document: SceneDocument;
  #access: Pick<SceneAccess, "can">;

  constructor(
    document: SceneDocument,
    access: Pick<SceneAccess, "can">
  ) {
    this.#document = document;
    this.#access = access;
  }

  canWriteActor(
    id: string,
    { name, visible, transform = {} }: SceneActorOverrideJSON
  ): boolean {
    const touchesHierarchy = name !== undefined || visible !== undefined;
    const touchesTransform = Object.keys(transform).length > 0;

    return (!touchesHierarchy || this.#access.can("hierarchy", id)) &&
      (!touchesTransform || this.#access.can("transforms", id));
  }

  canWriteComponent(
    id: string
  ): boolean {
    return this.#access.can("components", id);
  }

  rename(
    id: string,
    name: string
  ): boolean {
    return this.writeActor(id, { name });
  }

  changeVisibility(
    id: string,
    visible: boolean
  ): boolean {
    return this.writeActor(id, { visible });
  }

  transform(
    id: string,
    transform: SceneTransformPatch
  ): boolean {
    return this.writeActor(id, { transform });
  }

  changeComponent(
    id: string,
    change: ComponentChange
  ): boolean {
    if (!this.canWriteComponent(id)) {
      return false;
    }

    const target = Systems.InstancePath.parse(id);
    if (target === null) {
      return this.#document.changeComponent(id, change);
    }

    return this.#document.override(OverrideChange.component({
      id: target.instanceId,
      path: target.path,
      ...Object.keys(change.data).length === 0 ? {} : { set: { data: change.data } },
      ...change.unset.length === 0 ? {} : { unset: { data: [...change.unset] } }
    }));
  }

  changeComponentAssets(
    id: string,
    assets: Record<string, AssetReferenceJSON | null>
  ): boolean {
    return this.writeComponent(id, { assets });
  }

  writeActor(
    id: string,
    entry: SceneActorOverrideJSON
  ): boolean {
    if (!this.canWriteActor(id, entry)) {
      return false;
    }

    const target = Systems.InstancePath.parse(id);
    if (target !== null) {
      return this.#document.override(OverrideChange.actor({
        id: target.instanceId,
        path: target.path,
        set: entry
      }));
    }

    const { name, visible, transform = {} } = entry;

    return allCommitted([
      name === undefined ? null : this.#document.rename(id, name),
      visible === undefined ? null : this.#document.changeVisibility(id, visible),
      Object.keys(transform).length === 0 ? null : this.#document.transform(id, transform)
    ]);
  }

  writeComponent(
    id: string,
    entry: SceneComponentOverrideJSON
  ): boolean {
    if (!this.canWriteComponent(id)) {
      return false;
    }

    const target = Systems.InstancePath.parse(id);
    if (target !== null) {
      return this.#document.override(OverrideChange.component({
        id: target.instanceId,
        path: target.path,
        set: entry
      }));
    }

    const { data = {}, assets = {} } = entry;

    return allCommitted([
      Object.keys(data).length === 0 ?
        null :
        this.#document.changeComponent(id, new ComponentChange({ data })),
      Object.keys(assets).length === 0 ?
        null :
        this.#document.changeComponentAssets(id, assets)
    ]);
  }
}

function allCommitted(
  commits: readonly (boolean | null)[]
): boolean {
  const made = commits.filter((committed) => committed !== null);

  return made.length > 0 && made.every(Boolean);
}
