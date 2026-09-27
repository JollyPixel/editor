// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { AssetId } from "./AssetId.ts";
import { assertAssetKind } from "./assertAssetKind.ts";

// CONSTANTS
const kAssetRecordSchema = z.object({
  id: z.string(),
  kind: z.string(),
  source: z.string(),
  revision: z.string().optional()
});

export interface AssetRecordData {
  readonly id: string;
  readonly kind: string;
  readonly source: string;
  readonly revision?: string;
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
    assertAssetKind(options.kind);
    if (options.source.trim().length === 0) {
      throw new TypeError(
        "Asset source must not be empty."
      );
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

  toJSON(): AssetRecordData {
    return {
      id: this.id.value,
      kind: this.kind,
      source: this.source,
      ...(
        this.revision === undefined
          ? {}
          : { revision: this.revision }
      )
    };
  }

  static parse(
    input: unknown
  ): AssetRecord {
    return new AssetRecord(
      kAssetRecordSchema.parse(input)
    );
  }
}
