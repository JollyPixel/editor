// Import Third-party Dependencies
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";
import { resolveBinarySnapshot } from "@jolly-pixel/asset-server/client";
import { SnapshotDocument } from "@jolly-pixel/history";
import {
  commandDocumentKind,
  type CommandDocumentKind
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { SOUND_KIND } from "../asset/sound.ts";

export class SoundDocument extends SnapshotDocument<
  Uint8Array,
  Uint8Array | null
> {
  constructor() {
    super(null, (bytes) => bytes);
  }

  get bytes(): Uint8Array | null {
    const { value } = this;

    return value === null || value.byteLength === 0 ? null : value;
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
    keys: () => [],
    resolveSnapshot: resolveBinarySnapshot
  });
}
