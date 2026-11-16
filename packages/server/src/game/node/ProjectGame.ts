// Import Third-party Dependencies
import type { Member } from "@jolly-pixel/accounts";
import {
  AssetRoom,
  type AssetRecord
} from "@jolly-pixel/asset";
import type {
  AssetBuilds,
  CatalogProjection
} from "@jolly-pixel/asset-server";
import { SCRIPT_KIND } from "@jolly-pixel/scripting";

// Import Internal Dependencies
import { GameBuildError } from "./errors/GameBuildError.ts";
import type { Project } from "../../project/node/Project.ts";
import { UnknownAssetError } from "../../project/node/errors/UnknownAssetError.ts";
import {
  SCENE_KIND,
  gameManifest,
  scriptImports,
  type GameManifestData
} from "../GameManifest.ts";
import { GameModule } from "../GameModule.ts";

// CONSTANTS
const kImmutable = "private, max-age=31536000, immutable";
const kNoStore = "no-store";

export interface GameBackend {
  readonly catalog: CatalogProjection;
  readonly builds: AssetBuilds;
}

export interface ProjectGameOptions {
  project: Pick<Project, "access" | "physics">;
  backend: GameBackend;
}

export interface GameArtifact {
  readonly type: string;
  readonly bytes: Uint8Array;
  readonly cacheControl: string;
}

export class ProjectGame {
  #project: Pick<Project, "access" | "physics">;
  #backend: GameBackend;

  constructor(
    options: ProjectGameOptions
  ) {
    this.#project = options.project;
    this.#backend = options.backend;
  }

  manifest(
    account: Member,
    start: string
  ): GameManifestData {
    const scene = this.#readable(account, start);
    if (!scene.hasKind(SCENE_KIND)) {
      throw new UnknownAssetError(start);
    }

    return gameManifest(
      start,
      this.#records(account),
      this.#project.physics
    );
  }

  scriptImports(
    account: Member,
    base: string
  ): Record<string, string> {
    return scriptImports(this.#records(account), base);
  }

  async artifact(
    account: Member,
    assetId: string,
    revision: string | undefined
  ): Promise<GameArtifact> {
    const record = this.#readable(account, assetId);
    const built = await this.#backend.builds.build(assetId);
    if (!built.ok) {
      throw new GameBuildError(record.path.toString(), built.val);
    }

    return {
      type: built.val.type,
      bytes: built.val.bytes,
      cacheControl: record.revision === revision ? kImmutable : kNoStore
    };
  }

  async module(
    account: Member,
    path: string,
    revision: string | undefined
  ): Promise<GameArtifact> {
    const script = GameModule.parse(path)?.script;
    const record = script === undefined ?
      undefined :
      this.#backend.catalog.catalog.findByPath(script);
    if (record === undefined || !record.hasKind(SCRIPT_KIND)) {
      throw new UnknownAssetError(path);
    }

    return this.artifact(account, record.id.value, revision);
  }

  #records(
    account: Member
  ): AssetRecord[] {
    return Array.from(this.#backend.catalog.catalog)
      .filter((record) => this.#opens(account, record));
  }

  #readable(
    account: Member,
    assetId: string
  ): AssetRecord {
    const record = this.#backend.catalog.record(assetId);
    if (record === undefined || !this.#opens(account, record)) {
      throw new UnknownAssetError(assetId);
    }

    return record;
  }

  #opens(
    account: Member,
    record: AssetRecord
  ): boolean {
    return this.#project.access.opens(
      account.role,
      new AssetRoom(record.kind, record.id).toString()
    );
  }
}
