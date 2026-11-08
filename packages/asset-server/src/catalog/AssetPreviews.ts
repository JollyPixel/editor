// Import Third-party Dependencies
import type { AssetSource } from "@jolly-pixel/asset-source";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";
import { asError } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type { AssetKindRegistry } from "../model/kinds/AssetKindRegistry.ts";
import type {
  AnyAssetKindHandler,
  AssetPreview
} from "../model/kinds/AssetKindHandler.ts";
import type { CatalogProjection } from "./CatalogProjection.ts";
import { UnknownAssetError } from "../storage/writer/errors/UnknownAssetError.ts";

// CONSTANTS
const kMaxCachedBytes = 32 * 1024 * 1024;

export interface LiveAssetStates {
  get(
    assetId: string
  ): { readonly state: unknown; } | undefined;
}

export interface AssetPreviewsOptions {
  catalog: CatalogProjection;
  kinds: AssetKindRegistry;
  source: AssetSource;
  states: LiveAssetStates;
}

type PreviewHandler = AnyAssetKindHandler &
  Required<Pick<AnyAssetKindHandler, "preview">>;

interface CachedPreview {
  readonly revision: string | undefined;
  readonly preview: AssetPreview | null;
}

export class AssetPreviews {
  #catalog: CatalogProjection;
  #kinds: AssetKindRegistry;
  #source: AssetSource;
  #states: LiveAssetStates;
  #cached = new Map<string, CachedPreview>();
  #cachedBytes = 0;
  #pending = new Map<string, Promise<Result<AssetPreview | null, Error>>>();

  constructor(
    options: AssetPreviewsOptions
  ) {
    this.#catalog = options.catalog;
    this.#kinds = options.kinds;
    this.#source = options.source;
    this.#states = options.states;
  }

  preview(
    assetId: string
  ): Promise<Result<AssetPreview | null, Error>> {
    const record = this.#catalog.record(assetId);
    if (record === undefined) {
      const error = new UnknownAssetError(assetId);

      return Promise.resolve(Err(error));
    }

    const kind = record.kind.value;
    const handler = this.#kinds.has(kind) ? this.#kinds.get(kind) : null;
    if (handler === null || !drawsPreviews(handler)) {
      return Promise.resolve(Ok(null));
    }

    const { revision } = record;
    const cached = this.#cached.get(assetId);
    if (cached !== undefined && cached.revision === revision) {
      this.#touch(assetId, cached);

      return Promise.resolve(Ok(cached.preview));
    }

    const key = `${assetId}@${revision ?? ""}`;
    const pending = this.#pending.get(key);
    if (pending !== undefined) {
      return pending;
    }

    const drawn = this.#draw(handler, assetId, record.path.toString())
      .then((result) => {
        const current = this.#catalog.record(assetId)?.revision;
        if (result.ok && current === revision) {
          this.#store(assetId, {
            revision,
            preview: result.val
          });
        }

        return result;
      })
      .finally(() => this.#pending.delete(key));
    this.#pending.set(key, drawn);

    return drawn;
  }

  async #draw(
    handler: PreviewHandler,
    assetId: string,
    path: string
  ): Promise<Result<AssetPreview | null, Error>> {
    try {
      const live = this.#states.get(assetId);
      if (live !== undefined) {
        return Ok(await handler.preview(live.state));
      }

      const decoded = this.#kinds.decode(
        handler.kind,
        assetId,
        await this.#source.read(path)
      );
      if (!decoded.ok) {
        return decoded;
      }

      return Ok(await handler.preview(decoded.val.state));
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
