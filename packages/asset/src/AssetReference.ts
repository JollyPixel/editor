// Import Internal Dependencies
import { AssetId } from "./AssetId.ts";
import {
  AssetKindMismatchError
} from "./errors/AssetKindMismatchError.ts";
import type { AssetType } from "./AssetType.ts";

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
    if (
      typeof input !== "object" ||
      input === null ||
      Array.isArray(input)
    ) {
      throw new TypeError("Asset reference must be an object.");
    }
    if (
      !("id" in input) ||
      typeof input.id !== "string"
    ) {
      throw new TypeError("Asset reference ID must be a string.");
    }
    if (
      !("kind" in input) ||
      typeof input.kind !== "string"
    ) {
      throw new TypeError("Asset reference kind must be a string.");
    }
    const id = new AssetId(input.id);
    if (input.kind !== type.kind) {
      throw new AssetKindMismatchError(
        id,
        type.kind,
        input.kind
      );
    }

    return new AssetReference<TValue>(
      id,
      type
    );
  }
}
