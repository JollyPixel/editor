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
import { Systems } from "@jolly-pixel/engine";

export class ActorWrites {
  #document: SceneDocument;

  constructor(
    document: SceneDocument
  ) {
    this.#document = document;
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
