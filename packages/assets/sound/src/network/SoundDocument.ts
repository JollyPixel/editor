// Import Third-party Dependencies
import {
  decodeContent,
  type AssetInlineContent,
  type AssetRoomNotice
} from "@jolly-pixel/asset-server";
import { SnapshotDocument } from "@jolly-pixel/history";
import {
  commandDocumentKind,
  type CommandDocumentKind
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { SOUND_KIND } from "../asset/sound.ts";

export class SoundDocument extends SnapshotDocument<
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

export type SoundDocumentKind = CommandDocumentKind<
  typeof SOUND_KIND,
  SoundDocument,
  AssetRoomNotice
>;

export function soundDocumentKind(): SoundDocumentKind {
  return commandDocumentKind({
    kind: SOUND_KIND,
    createDocument: () => new SoundDocument(),
    keys: () => []
  });
}
