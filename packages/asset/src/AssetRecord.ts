// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import { AssetId } from "./AssetId.ts";
import { AssetKind } from "./AssetKind.ts";
import { AssetPath } from "./AssetPath.ts";

// CONSTANTS
const kAssetRecordSchema = z.object({
  id: z.string(),
  kind: z.string(),
  path: z.string(),
  revision: z.optional(z.string())
});

export interface AssetRecordData {
  readonly id: string;
  readonly kind: string;
  readonly path: string;
  readonly revision?: string;
}

export interface AssetRecordOptions {
  readonly id: AssetId | string;
  readonly kind: AssetKind | string;
  readonly path: AssetPath | string;
  readonly revision?: string;
}

export class AssetRecord {
  readonly id: AssetId;
  readonly kind: AssetKind;
  readonly path: AssetPath;
  readonly revision: string | undefined;

  constructor(
    options: AssetRecordOptions
  ) {
    if (
      options.revision !== undefined &&
      options.revision.trim().length === 0
    ) {
      throw new TypeError(
        "Asset revision must not be empty when provided."
      );
    }

    this.id = AssetId.from(options.id);
    this.kind = AssetKind.from(options.kind);
    this.path = AssetPath.from(options.path);
    this.revision = options.revision;
  }

  hasKind(
    kind: AssetKind | string
  ): boolean {
    return this.kind.equals(AssetKind.from(kind));
  }

  toJSON(): AssetRecordData {
    return {
      id: this.id.value,
      kind: this.kind.value,
      path: this.path.toString(),
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
