// Import Internal Dependencies
import { AssetId } from "./AssetId.ts";
import { assertAssetKind } from "./assertAssetKind.ts";

// CONSTANTS
const kTagSeparator = "@";

export class AssetRoom {
  static parse(
    roomName: string
  ): AssetRoom | null {
    const separator = roomName.indexOf(":");
    if (separator === -1) {
      return null;
    }

    const head = roomName.slice(0, separator);
    const tagAt = head.indexOf(kTagSeparator);

    try {
      return new AssetRoom(
        tagAt === -1 ? head : head.slice(0, tagAt),
        roomName.slice(separator + 1),
        tagAt === -1 ? null : head.slice(tagAt + 1)
      );
    }
    catch {
      return null;
    }
  }

  readonly kind: string;
  readonly assetId: AssetId;
  readonly tag: string | null;

  constructor(
    kind: string,
    assetId: string | AssetId,
    tag: string | null = null
  ) {
    assertAssetKind(kind);
    if (kind.includes(kTagSeparator)) {
      throw new TypeError("Asset room kind must not contain \"@\".");
    }
    if (tag !== null && (tag.trim().length === 0 || tag.includes(":"))) {
      throw new TypeError("Asset room tag must be non-empty without a colon.");
    }

    this.kind = kind;
    this.assetId = AssetId.from(assetId);
    this.tag = tag;
  }

  equals(
    other: AssetRoom
  ): boolean {
    const hasEqualKind = this.kind === other.kind;
    const hasEqualAssetId = this.assetId.equals(
      other.assetId
    );

    return hasEqualKind && hasEqualAssetId && this.tag === other.tag;
  }

  toJSON(): string {
    return this.toString();
  }

  toString(): string {
    const head = this.tag === null ?
      this.kind :
      `${this.kind}${kTagSeparator}${this.tag}`;

    return `${head}:${this.assetId.value}`;
  }
}
