/**
 * Identifies one catalog asset independently from its physical source.
 */
export class AssetId {
  readonly value: string;

  constructor(
    value: string
  ) {
    if (value.trim().length === 0) {
      throw new TypeError("Asset identifier must not be empty.");
    }

    this.value = value;
  }

  equals(
    other: AssetId
  ): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
