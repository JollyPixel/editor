// Import Third-party Dependencies
import type { AssetRecord } from "@jolly-pixel/asset";
import {
  UnbuildableAssetError,
  type BuiltAsset
} from "@jolly-pixel/asset-server";
import {
  SCRIPT_KIND,
  ScriptModules
} from "@jolly-pixel/scripting";

// Import Internal Dependencies
import { GameBuildError } from "./errors/GameBuildError.ts";
import type { GameBackend } from "./ProjectGame.ts";
import type { GameExportAssets } from "../api.ts";
import { SCENE_KIND } from "../GameManifest.ts";

// CONSTANTS
const kModelKind = "model";

export interface GameAssetBuild {
  readonly record: AssetRecord;
  readonly artifact: BuiltAsset;
}

export class GameAssets {
  #backend: GameBackend;
  #follows: boolean;
  #reached = new Set<string>();
  #queue: AssetRecord[] = [];

  constructor(
    backend: GameBackend,
    assets: GameExportAssets
  ) {
    const { catalog } = backend.catalog;

    this.#backend = backend;
    this.#follows = assets === "reachable";
    this.#reach(this.#follows ? catalog.byKind(SCENE_KIND) : catalog);
  }

  async* builds(): AsyncGenerator<GameAssetBuild> {
    for (let index = 0; index < this.#queue.length; index++) {
      const record = this.#queue[index];
      const built = await this.#backend.builds.build(record.id.value);
      if (!built.ok) {
        if (built.val instanceof UnbuildableAssetError) {
          continue;
        }

        throw new GameBuildError(record.path.toString(), built.val);
      }

      if (this.#follows) {
        await this.#follow(record, built.val);
      }
      yield {
        record,
        artifact: built.val
      };
    }
  }

  async #follow(
    record: AssetRecord,
    artifact: BuiltAsset
  ): Promise<void> {
    const projection = this.#backend.catalog;

    this.#reach(
      projection.dependencies
        .listDependencies(record.id.value)
        .flatMap(({ id }) => projection.record(id) ?? [])
    );
    if (record.hasKind(SCRIPT_KIND)) {
      this.#reach(await new ScriptModules(projection.catalog).imported(
        record,
        new TextDecoder().decode(artifact.bytes)
      ));
    }
    if (record.hasKind(kModelKind)) {
      this.#reach(this.#modelFiles(record));
    }
  }

  * #modelFiles(
    model: AssetRecord
  ): IterableIterator<AssetRecord> {
    const folder = model.path.directory;
    for (const record of this.#backend.catalog.catalog) {
      if (
        record.path.value.startsWith(folder) &&
        !record.hasKind(SCRIPT_KIND)
      ) {
        yield record;
      }
    }
  }

  #reach(
    records: Iterable<AssetRecord>
  ): void {
    for (const record of records) {
      if (!this.#reached.has(record.id.value)) {
        this.#reached.add(record.id.value);
        this.#queue.push(record);
      }
    }
  }
}
