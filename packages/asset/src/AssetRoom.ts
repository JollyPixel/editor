// Import Internal Dependencies
import { AssetId } from "./AssetId.ts";

export class AssetRoom {
  static parse(
    roomName: string
  ): AssetRoom | null {
    const separator = roomName.indexOf(":");
    if (separator <= 0) {
      return null;
    }

    const assetId = roomName.slice(separator + 1);
    if (assetId.trim().length === 0) {
      return null;
    }

    return new AssetRoom(roomName.slice(0, separator), assetId);
  }

  readonly kind: string;
  readonly assetId: AssetId;

  constructor(
    kind: string,
    assetId: string | AssetId
  ) {
    if (kind.length === 0 || kind.includes(":")) {
      throw new TypeError("Asset room kind must be non-empty without a colon.");
    }

    this.kind = kind;
    this.assetId = AssetId.from(assetId);
  }

  equals(
    other: AssetRoom
  ): boolean {
    return this.kind === other.kind && this.assetId.equals(other.assetId);
  }

  toJSON(): string {
    return this.toString();
  }

  toString(): string {
    return `${this.kind}:${this.assetId.value}`;
  }
}
