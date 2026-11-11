// Import Third-party Dependencies
import type { AssetRecord } from "@jolly-pixel/asset";
import type { AssetSource } from "@jolly-pixel/asset-source";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type { AssetKindRegistry } from "../../model/kinds/AssetKindRegistry.ts";
import type { AnyAssetKindHandler } from "../../model/kinds/AssetKindHandler.ts";
import type { CatalogProjection } from "../CatalogProjection.ts";
import { UnknownAssetError } from "../../storage/writer/errors/UnknownAssetError.ts";

export interface LiveAssetStates {
  get(
    assetId: string
  ): { readonly state: unknown; } | undefined;
}

export interface AssetStatesOptions {
  catalog: CatalogProjection;
  kinds: AssetKindRegistry;
  source: AssetSource;
  states: LiveAssetStates;
}

export interface CatalogAsset {
  readonly record: AssetRecord;
  readonly handler: AnyAssetKindHandler | null;
}

export interface LoadedAsset {
  readonly content: Uint8Array;

  state(): Result<unknown, Error>;
}

export class AssetStates {
  #catalog: CatalogProjection;
  #kinds: AssetKindRegistry;
  #source: AssetSource;
  #states: LiveAssetStates;

  constructor(
    options: AssetStatesOptions
  ) {
    this.#catalog = options.catalog;
    this.#kinds = options.kinds;
    this.#source = options.source;
    this.#states = options.states;
  }

  find(
    assetId: string
  ): Result<CatalogAsset, UnknownAssetError> {
    const record = this.#catalog.record(assetId);
    if (record === undefined) {
      const error = new UnknownAssetError(assetId);

      return Err(error);
    }

    const kind = record.kind.value;

    return Ok({
      record,
      handler: this.#kinds.has(kind) ? this.#kinds.get(kind) : null
    });
  }

  isCurrent(
    record: AssetRecord
  ): boolean {
    return this.#catalog.record(record.id.value)?.revision === record.revision;
  }

  async state(
    handler: AnyAssetKindHandler,
    record: AssetRecord
  ): Promise<Result<unknown, Error>> {
    const live = this.#states.get(record.id.value);
    if (live !== undefined) {
      return Ok(live.state);
    }

    return this.#decode(
      handler,
      record,
      await this.#source.read(record.path.toString())
    );
  }

  async load(
    handler: AnyAssetKindHandler,
    record: AssetRecord
  ): Promise<LoadedAsset> {
    const live = this.#states.get(record.id.value);
    if (live !== undefined) {
      return {
        content: await handler.serialize(live.state),
        state: () => Ok(live.state)
      };
    }

    const content = await this.#source.read(record.path.toString());

    return {
      content,
      state: () => this.#decode(handler, record, content)
    };
  }

  #decode(
    handler: AnyAssetKindHandler,
    record: AssetRecord,
    content: Uint8Array
  ): Result<unknown, Error> {
    const decoded = this.#kinds.decode(handler.kind, record.id.value, content);

    return decoded.ok ? Ok(decoded.val.state) : decoded;
  }
}

export function revisionKey(
  record: AssetRecord
): string {
  return `${record.id.value}@${record.revision ?? ""}`;
}
