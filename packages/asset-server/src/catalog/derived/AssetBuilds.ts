// Import Third-party Dependencies
import type { AssetRecord } from "@jolly-pixel/asset";
import type { AssetSource } from "@jolly-pixel/asset-source";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import { asError } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { contentHash } from "../../common/contentHash.ts";
import { InFlight } from "../../common/InFlight.ts";
import type {
  AnyAssetKindHandler,
  AssetBuild
} from "../../model/kinds/AssetKindHandler.ts";
import { BUILDS_PATH } from "../../storage/stateDirectory.ts";
import {
  AssetStates,
  revisionKey,
  type AssetStatesOptions,
  type LoadedAsset
} from "./AssetStates.ts";
import { UnbuildableAssetError } from "./errors/UnbuildableAssetError.ts";

// CONSTANTS
const kDefaultContentType = "application/octet-stream";

export type AssetBuildsOptions = AssetStatesOptions;

export interface BuiltAsset {
  /**
   * Hash of the kind, its build version and the asset content: equal keys
   * hold equal bytes.
   */
  readonly key: string;
  readonly type: string;
  readonly bytes: Uint8Array;
}

type BuildHandler = AnyAssetKindHandler & {
  readonly build: AssetBuild<unknown>;
};

export class AssetBuilds {
  #assets: AssetStates;
  #source: AssetSource;
  #keys = new Map<string, string>();
  #pending = new InFlight<Result<BuiltAsset, Error>>();

  constructor(
    options: AssetBuildsOptions
  ) {
    this.#assets = new AssetStates(options);
    this.#source = options.source;
  }

  build(
    assetId: string
  ): Promise<Result<BuiltAsset, Error>> {
    const found = this.#assets.find(assetId);
    if (!found.ok) {
      return Promise.resolve(found);
    }

    const { record, handler } = found.val;
    if (handler === null || !builds(handler)) {
      const error = new UnbuildableAssetError(assetId, record.kind.value);

      return Promise.resolve(Err(error));
    }

    return this.#pending.run(
      revisionKey(record),
      () => this.#build(handler, record)
    );
  }

  async #build(
    handler: BuildHandler,
    record: AssetRecord
  ): Promise<Result<BuiltAsset, Error>> {
    const type = contentType(handler, record);
    try {
      const known = this.#keys.get(revisionKey(record));
      if (known !== undefined && await this.#source.exists(artifactPath(known))) {
        return Ok({
          key: known,
          type,
          bytes: await this.#source.read(artifactPath(known))
        });
      }

      const loaded = await this.#assets.load(handler, record);
      const key = await artifactKey(handler, loaded.content);
      const bytes = await this.#artifact(handler, key, loaded);
      if (!bytes.ok) {
        return bytes;
      }
      if (this.#assets.isCurrent(record)) {
        this.#keys.set(revisionKey(record), key);
      }

      return Ok({
        key,
        type,
        bytes: bytes.val
      });
    }
    catch (error) {
      return Err(asError(error));
    }
  }

  async #artifact(
    handler: BuildHandler,
    key: string,
    loaded: LoadedAsset
  ): Promise<Result<Uint8Array, Error>> {
    const path = artifactPath(key);
    if (await this.#source.exists(path)) {
      return Ok(await this.#source.read(path));
    }

    const state = loaded.state();
    if (!state.ok) {
      return state;
    }

    const bytes = await handler.build.build(state.val, loaded.content);
    await this.#source.write(path, bytes);

    return Ok(bytes);
  }
}

function builds(
  handler: AnyAssetKindHandler
): handler is BuildHandler {
  return handler.build !== undefined;
}

function artifactPath(
  key: string
): string {
  return `${BUILDS_PATH}/${key}`;
}

async function artifactKey(
  handler: BuildHandler,
  content: Uint8Array
): Promise<string> {
  const hashed = await contentHash(content);

  return contentHash(new TextEncoder().encode(
    `${handler.kind}\n${handler.build.version}\n${hashed}`
  ));
}

function contentType(
  handler: BuildHandler,
  record: AssetRecord
): string {
  if (handler.build.type !== undefined) {
    return handler.build.type;
  }

  const extension = record.path.matchExtension(
    Object.keys(handler.extensions)
  );

  return extension === null ?
    kDefaultContentType :
    handler.extensions[extension];
}
