// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { AssetId } from "./AssetId.ts";
import {
  AssetKindMismatchError
} from "./errors/AssetKindMismatchError.ts";
import type { AssetType } from "./AssetType.ts";

// CONSTANTS
const kAssetReferenceSchema = z.object({
  id: z.string(),
  kind: z.string()
});

export interface AssetReferenceData {
  readonly id: string;
  readonly kind: string;
}

export type AssetReferenceGroup = Readonly<
  Record<string, AssetReference<unknown>>
>;

/**
 * Stores the stable ID and runtime kind expected by a scene or component.
 */
export class AssetReference<
  TValue = unknown
> {
  readonly id: AssetId;
  readonly type: AssetType<TValue>;

  constructor(
    id: AssetId | string,
    type: AssetType<TValue>
  ) {
    this.id = AssetId.from(id);
    this.type = type;
  }

  get kind(): string {
    return this.type.kind;
  }

  equals(
    other: AssetReference<unknown>
  ): boolean {
    const isIdEqual = this.id.equals(other.id);
    const isKindEqual = this.kind === other.kind;

    return isIdEqual && isKindEqual;
  }

  toJSON(): AssetReferenceData {
    return {
      id: this.id.value,
      kind: this.kind
    };
  }

  static parse<TValue>(
    input: unknown,
    type: AssetType<TValue>
  ): AssetReference<TValue> {
    const data = kAssetReferenceSchema.parse(input);
    const id = new AssetId(data.id);
    if (data.kind !== type.kind) {
      throw new AssetKindMismatchError(
        id,
        type.kind,
        data.kind
      );
    }

    return new AssetReference(
      id,
      type
    );
  }
}
