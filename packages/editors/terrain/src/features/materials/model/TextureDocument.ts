// Import Third-party Dependencies
import {
  decodeContent,
  TEXTURE_KIND,
  type AssetInlineContent,
  type AssetRoomNotice
} from "@jolly-pixel/asset-server";
import {
  CommandDocument,
  type CommandState
} from "@jolly-pixel/history";
import {
  SyncedCommandDocument,
  type CommandDocumentKind
} from "@jolly-pixel/network/client";

export interface TextureCommand {
  readonly action: "none";
}

interface TextureContent {
  bytes: Uint8Array | null;
}

export class TextureDocument extends CommandDocument<
  TextureCommand,
  AssetInlineContent,
  null
> {
  #content: TextureContent;

  constructor() {
    const content: TextureContent = { bytes: null };
    super(textureState(content));
    this.#content = content;
  }

  get bytes(): Uint8Array | null {
    return this.#content.bytes;
  }
}

export type TextureDocumentKind = CommandDocumentKind<
  typeof TEXTURE_KIND,
  TextureDocument,
  AssetRoomNotice
>;

export function textureDocumentKind(): TextureDocumentKind {
  return {
    kind: TEXTURE_KIND,
    syncDocument: (room) => new SyncedCommandDocument(room, {
      document: new TextureDocument(),
      keys: () => []
    })
  };
}

function textureState(
  content: TextureContent
): CommandState<TextureCommand, AssetInlineContent, null> {
  return {
    accepts: () => false,
    placeable: (command) => command,
    apply: () => undefined,
    load: (snapshot) => {
      content.bytes = decodeContent(snapshot);
    },
    captureImage: () => null,
    invert: () => [],
    restored: () => {
      throw new Error("A texture has no command to rewind.");
    }
  };
}
