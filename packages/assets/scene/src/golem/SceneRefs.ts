// Import Third-party Dependencies
import {
  KindMismatchError,
  resolveEntry,
  UnknownAssetError,
  type CatalogReader
} from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import {
  SCENE_ENVIRONMENT_KIND,
  type SceneComponentJSON,
  type SceneEnvironmentJSON,
  type SceneTreeReader
} from "../network/client.ts";

export type AssetReference = NonNullable<SceneComponentJSON["assets"][string]>;

export type AssetRef = string | AssetReference | null;

export class SceneRefs {
  #tree: SceneTreeReader;
  #catalog: CatalogReader;

  constructor(
    tree: SceneTreeReader,
    catalog: CatalogReader
  ) {
    this.#tree = tree;
    this.#catalog = catalog;
  }

  actor(
    nameOrId: string
  ): string {
    return resolveEntry("actor", nameOrId, this.#tree.actors(), (actor) => {
      const parent = actor.parentId === null ?
        undefined :
        this.#tree.actor(actor.parentId);

      return parent === undefined ?
        `${actor.id} at the root` :
        `${actor.id} under ${JSON.stringify(parent.name)}`;
    }).id;
  }

  asset(
    ref: AssetRef
  ): AssetReference | null {
    if (ref === null || typeof ref === "object") {
      return ref;
    }

    return this.#record(ref);
  }

  environment(
    ref: string | null
  ): SceneEnvironmentJSON {
    if (ref === null) {
      return null;
    }

    const { id, kind } = this.#record(ref);
    if (kind !== SCENE_ENVIRONMENT_KIND) {
      throw new KindMismatchError(id, kind, [SCENE_ENVIRONMENT_KIND]);
    }

    return {
      id,
      kind
    };
  }

  #record(
    ref: string
  ): AssetReference {
    const record = this.#catalog.record(ref) ??
      [...this.#catalog.records()].find(({ path }) => path === ref);
    if (record === undefined) {
      throw new UnknownAssetError(ref);
    }

    return {
      id: record.id,
      kind: record.kind
    };
  }
}
