// Import Third-party Dependencies
import type { AssetRecord } from "@jolly-pixel/asset";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import { asError } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { InFlight } from "../common/InFlight.ts";
import type {
  AnyAssetKindHandler,
  AssetPreview
} from "../model/kinds/AssetKindHandler.ts";
import {
  AssetStates,
  revisionKey,
  type AssetStatesOptions
} from "./AssetStates.ts";

// CONSTANTS
const kMaxCachedBytes = 32 * 1024 * 1024;

export type AssetPreviewsOptions = AssetStatesOptions;

type PreviewHandler = AnyAssetKindHandler &
  Required<Pick<AnyAssetKindHandler, "preview">>;

interface CachedPreview {
  readonly revision: string | undefined;
  readonly preview: AssetPreview | null;
}

export class AssetPreviews {
  #assets: AssetStates;
  #cached = new Map<string, CachedPreview>();
  #cachedBytes = 0;
  #pending = new InFlight<Result<AssetPreview | null, Error>>();

  constructor(
    options: AssetPreviewsOptions
  ) {
    this.#assets = new AssetStates(options);
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

    const { revision } = record;
    const cached = this.#cached.get(assetId);
    if (cached !== undefined && cached.revision === revision) {
      this.#touch(assetId, cached);

      return Promise.resolve(Ok(cached.preview));
    }

    return this.#pending.run(revisionKey(record), async() => {
      const result = await this.#draw(handler, record);
      if (result.ok && this.#assets.isCurrent(record)) {
        this.#store(assetId, {
          revision,
          preview: result.val
        });
      }

      return result;
    });
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

  #touch(
    assetId: string,
    cached: CachedPreview
  ): void {
    this.#cached.delete(assetId);
    this.#cached.set(assetId, cached);
  }

  #store(
    assetId: string,
    cached: CachedPreview
  ): void {
    const previous = this.#cached.get(assetId);
    if (previous !== undefined) {
      this.#cached.delete(assetId);
      this.#cachedBytes -= previewBytes(previous);
    }

    const bytes = previewBytes(cached);
    if (bytes > kMaxCachedBytes) {
      return;
    }

    this.#cached.set(assetId, cached);
    this.#cachedBytes += bytes;
    for (const [oldest, entry] of this.#cached) {
      if (this.#cachedBytes <= kMaxCachedBytes) {
        break;
      }
      this.#cached.delete(oldest);
      this.#cachedBytes -= previewBytes(entry);
    }
  }
}

function previewBytes(
  cached: CachedPreview
): number {
  return cached.preview?.bytes.byteLength ?? 0;
}

function drawsPreviews(
  handler: AnyAssetKindHandler
): handler is PreviewHandler {
  return handler.preview !== undefined;
}
