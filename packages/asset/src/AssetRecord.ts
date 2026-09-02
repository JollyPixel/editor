// Import Internal Dependencies
import { AssetId } from "./AssetId.ts";
import { AssetFetchError } from "./errors/AssetFetchError.ts";
import {
  assetSourceUrl,
  ASSET_URL_PREFIX
} from "./urls.ts";

export interface AssetRecordData {
  readonly id: string;
  readonly kind: string;
  readonly source: string;
  readonly revision?: string;
}

export interface AssetRecordFetchOptions extends RequestInit {
  prefix?: string;
}

export interface AssetRecordOptions {
  readonly id: AssetId | string;
  readonly kind: string;
  readonly source: string;
  readonly revision?: string;
}

/**
 * Describes the current source and revision assigned to a stable asset ID.
 */
export class AssetRecord {
  readonly id: AssetId;
  readonly kind: string;
  readonly source: string;
  readonly revision: string | undefined;

  constructor(
    options: AssetRecordOptions
  ) {
    if (options.kind.trim().length === 0) {
      throw new TypeError("Asset kind must not be empty.");
    }
    if (options.source.trim().length === 0) {
      throw new TypeError("Asset source must not be empty.");
    }
    if (
      options.revision !== undefined &&
      options.revision.trim().length === 0
    ) {
      throw new TypeError(
        "Asset revision must not be empty when provided."
      );
    }

    this.id = AssetId.from(options.id);
    this.kind = options.kind;
    this.source = options.source;
    this.revision = options.revision;
  }

  sourceUrl(
    prefix: string = ASSET_URL_PREFIX
  ): string {
    return assetSourceUrl(this.source, prefix);
  }

  async fetch(
    options: AssetRecordFetchOptions = {}
  ): Promise<Response> {
    const {
      prefix,
      ...init
    } = options;
    const url = this.sourceUrl(prefix);

    const response = await fetch(url, init);
    if (!response.ok) {
      throw new AssetFetchError(
        url,
        response.status,
        this
      );
    }

    return response;
  }

  async text(
    options?: AssetRecordFetchOptions
  ): Promise<string> {
    const response = await this.fetch(options);

    return response.text();
  }

  toJSON(): AssetRecordData {
    if (this.revision === undefined) {
      return {
        id: this.id.value,
        kind: this.kind,
        source: this.source
      };
    }

    return {
      id: this.id.value,
      kind: this.kind,
      source: this.source,
      revision: this.revision
    };
  }

  static parse(
    input: unknown
  ): AssetRecord {
    if (
      typeof input !== "object" ||
      input === null ||
      Array.isArray(input)
    ) {
      throw new TypeError("Asset record must be an object.");
    }
    if (
      !("id" in input) ||
      typeof input.id !== "string"
    ) {
      throw new TypeError("Asset record ID must be a string.");
    }
    if (
      !("kind" in input) ||
      typeof input.kind !== "string"
    ) {
      throw new TypeError("Asset record kind must be a string.");
    }
    if (
      !("source" in input) ||
      typeof input.source !== "string"
    ) {
      throw new TypeError("Asset record source must be a string.");
    }

    let revision: string | undefined;
    if ("revision" in input) {
      if (
        input.revision !== undefined &&
        typeof input.revision !== "string"
      ) {
        throw new TypeError(
          "Asset record revision must be a string when provided."
        );
      }
      revision = input.revision;
    }

    return new AssetRecord({
      id: input.id,
      kind: input.kind,
      source: input.source,
      revision
    });
  }
}
