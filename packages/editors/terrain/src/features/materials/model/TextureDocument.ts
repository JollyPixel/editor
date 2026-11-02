// Import Third-party Dependencies
import {
  decodeContent,
  TEXTURE_KIND,
  type AssetInlineContent,
  type AssetRoomNotice
} from "@jolly-pixel/asset-server";
import { SnapshotDocument } from "@jolly-pixel/history";
import {
  commandDocumentKind,
  type CommandDocumentKind
} from "@jolly-pixel/network/client";

export class TextureDocument extends SnapshotDocument<
  AssetInlineContent,
  Uint8Array | null
> {
  constructor() {
    super(null, decodeContent);
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
