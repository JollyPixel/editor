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
  AssetPreview
} from "../../model/kinds/AssetKindHandler.ts";
import {
  AssetStates,
  type AssetStatesOptions
} from "./AssetStates.ts";
import { RevisionCache } from "./RevisionCache.ts";

// CONSTANTS
const kMaxCachedBytes = 32 * 1024 * 1024;

export type AssetPreviewsOptions = AssetStatesOptions;

type PreviewHandler = AnyAssetKindHandler &
  Required<Pick<AnyAssetKindHandler, "preview">>;

export class AssetPreviews {
  #assets: AssetStates;
  #previews: RevisionCache<AssetPreview | null>;

  constructor(
    options: AssetPreviewsOptions
  ) {
    this.#assets = new AssetStates(options);
    this.#previews = new RevisionCache({
      assets: this.#assets,
      maxBytes: kMaxCachedBytes,
      measure: (preview) => preview?.bytes.byteLength ?? 0
    });
  }

  preview(
    assetId: string
  ): Promise<Result<AssetPreview | null, Error>> {
    const found = this.#assets.find(assetId);
    if (!found.ok) {
      return Promise.resolve(found);
    }

    const { record, handler } = found.val;
    if (handler === null || !drawsPreviews(handler)) {
      return Promise.resolve(Ok(null));
    }

    return this.#previews.resolve(record, () => this.#draw(handler, record));
  }

  async #draw(
    handler: PreviewHandler,
    record: AssetRecord
  ): Promise<Result<AssetPreview | null, Error>> {
    try {
      const state = await this.#assets.state(handler, record);
      if (!state.ok) {
        return state;
      }

      return Ok(await handler.preview(state.val));
    }
    catch (error) {
      return Err(asError(error));
    }
  }
}

function drawsPreviews(
  handler: AnyAssetKindHandler
): handler is PreviewHandler {
  return handler.preview !== undefined;
}
