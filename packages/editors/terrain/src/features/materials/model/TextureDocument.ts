// Import Third-party Dependencies
import {
  TEXTURE_KIND,
  type AssetRoomNotice
} from "@jolly-pixel/asset-server";
import { SnapshotDocument } from "@jolly-pixel/history";
import {
  commandDocumentKind,
  type CommandDocumentKind
} from "@jolly-pixel/network/client";

export class TextureDocument extends SnapshotDocument<
  Uint8Array,
  Uint8Array | null
> {
  constructor() {
    super(null, (bytes) => bytes);
  }

  get bytes(): Uint8Array | null {
    return this.value;
  }
}

export type TextureDocumentKind = CommandDocumentKind<
  typeof TEXTURE_KIND,
  TextureDocument,
  AssetRoomNotice
>;

export function textureDocumentKind(): TextureDocumentKind {
  return commandDocumentKind({
    kind: TEXTURE_KIND,
    createDocument: () => new TextureDocument(),
    keys: () => []
  });
}
