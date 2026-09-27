// Import Internal Dependencies
import { AssetId } from "./AssetId.ts";
import { assertAssetKind } from "./assertAssetKind.ts";

export class AssetRoom {
  static parse(
    roomName: string
  ): AssetRoom | null {
    const separator = roomName.indexOf(":");
    if (separator === -1) {
      return null;
    }

    try {
      return new AssetRoom(
        roomName.slice(0, separator),
        roomName.slice(separator + 1)
      );
    }
    catch {
      return null;
    }
  }

  readonly kind: string;
  readonly assetId: AssetId;

  constructor(
    kind: string,
    assetId: string | AssetId
  ) {
    assertAssetKind(kind);

    this.kind = kind;
    this.assetId = AssetId.from(assetId);
  }

  equals(
    other: AssetRoom
  ): boolean {
    const hasEqualKind = this.kind === other.kind;
    const hasEqualAssetId = this.assetId.equals(
      other.assetId
    );

    return hasEqualKind && hasEqualAssetId;
  }

  toJSON(): string {
    return this.toString();
  }

  toString(): string {
    return `${this.kind}:${this.assetId.value}`;
  }
}
