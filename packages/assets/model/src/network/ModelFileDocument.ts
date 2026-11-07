// Import Third-party Dependencies
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";
import { SnapshotDocument } from "@jolly-pixel/history";
import {
  commandDocumentKind,
  type CommandDocumentKind
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { MODEL_KIND } from "../asset/model.ts";

export class ModelFileDocument extends SnapshotDocument<
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

export type ModelFileDocumentKind = CommandDocumentKind<
  typeof MODEL_KIND,
  ModelFileDocument,
  AssetRoomNotice
>;

export function modelFileDocumentKind(): ModelFileDocumentKind {
  return commandDocumentKind({
    kind: MODEL_KIND,
    createDocument: () => new ModelFileDocument(),
    keys: () => []
  });
}
