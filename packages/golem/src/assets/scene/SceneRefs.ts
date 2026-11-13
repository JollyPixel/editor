// Import Third-party Dependencies
import type {
  SceneComponentJSON,
  SceneTreeReader
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import type { CatalogReader } from "../GolemAsset.ts";
import { resolveEntry } from "../resolveEntry.ts";
import { UnknownAssetError } from "../../peer/errors/UnknownAssetError.ts";

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
