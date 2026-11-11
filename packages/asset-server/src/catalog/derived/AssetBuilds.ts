// Import Third-party Dependencies
import type { AssetRecord } from "@jolly-pixel/asset";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import { asError } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type {
  AnyAssetKindHandler,
  AssetBuild
} from "../../model/kinds/AssetKindHandler.ts";
import { PASS_THROUGH_BUILD } from "../../model/kinds/authoring/passThroughBuild.ts";
import {
  AssetStates,
  type AssetStatesOptions
} from "./AssetStates.ts";
import { RevisionCache } from "./RevisionCache.ts";
import { UnbuildableAssetError } from "./errors/UnbuildableAssetError.ts";

// CONSTANTS
const kDefaultContentType = "application/octet-stream";
const kMaxCachedBytes = 64 * 1024 * 1024;

export type AssetBuildsOptions = AssetStatesOptions;

export interface BuiltAsset {
  readonly type: string;
  readonly bytes: Uint8Array;
}

type BuildHandler = AnyAssetKindHandler & {
  readonly build: AssetBuild<unknown>;
};

export class AssetBuilds {
  #assets: AssetStates;
  #builds: RevisionCache<BuiltAsset>;

  constructor(
    options: AssetBuildsOptions
  ) {
    this.#assets = new AssetStates(options);
    this.#builds = new RevisionCache({
      assets: this.#assets,
      maxBytes: kMaxCachedBytes,
      measure: (built) => built.bytes.byteLength
    });
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

    const build = () => this.#build(handler, record);

    return handler.build === PASS_THROUGH_BUILD ?
      build() :
      this.#builds.resolve(record, build);
  }

  async #build(
    handler: BuildHandler,
    record: AssetRecord
  ): Promise<Result<BuiltAsset, Error>> {
    try {
      const loaded = await this.#assets.load(handler, record);
      const state = loaded.state();
      if (!state.ok) {
        return state;
      }

      return Ok({
        type: contentType(handler, record),
        bytes: await handler.build.build(state.val, loaded.content)
      });
    }
    catch (error) {
      return Err(asError(error));
    }
  }
}

function builds(
  handler: AnyAssetKindHandler
): handler is BuildHandler {
  return handler.build !== undefined;
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
