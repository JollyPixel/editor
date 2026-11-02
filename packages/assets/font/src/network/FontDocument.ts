// Import Third-party Dependencies
import { SnapshotDocument } from "@jolly-pixel/history";
import {
  commandDocumentKind,
  type CommandDocumentKind
} from "@jolly-pixel/network/client";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { FONT_KIND } from "../asset/font.ts";
import type { Typeface } from "../typeface/typeface.ts";

export class FontDocument extends SnapshotDocument<Typeface | null> {
  constructor() {
    super(null, (typeface) => typeface);
  }

  get typeface(): Typeface | null {
    return this.value;
  }
}

export type FontDocumentKind = CommandDocumentKind<
  typeof FONT_KIND,
  FontDocument,
  AssetRoomNotice
>;

export function fontDocumentKind(): FontDocumentKind {
  return commandDocumentKind({
    kind: FONT_KIND,
    createDocument: () => new FontDocument(),
    keys: () => []
  });
}
