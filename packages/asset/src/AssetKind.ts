export class AssetKind {
  static from(
    kind: string | AssetKind
  ): AssetKind {
    return typeof kind === "string"
      ? new AssetKind(kind)
      : kind;
  }

  readonly value: string;

  constructor(
    value: string
  ) {
    if (
      value.trim().length === 0 ||
      value.includes(":") ||
      value.includes("@")
    ) {
      throw new TypeError(
        "Asset kind must be non-empty without \":\" or \"@\"."
      );
    }

    this.value = value;
  }

  equals(
    other: AssetKind
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
