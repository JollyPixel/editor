// Import Third-party Dependencies
import { SyncedDocument } from "@jolly-pixel/network/client";
import {
  PixelDocument,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PIXEL_ART_KIND } from "../asset/pixelArt.ts";
import { PixelSyncClient } from "./PixelSyncClient.ts";
import type { PixelArtRoom } from "./types.ts";

// CONSTANTS
const kInitialSize: Vec2 = { x: 1, y: 1 };

export interface SyncedPixelDocumentOptions {
  maxSize?: number;
}

export function blankPixelDocument(
  options: SyncedPixelDocumentOptions = {}
): PixelDocument {
  return new PixelDocument({
    size: kInitialSize,
    maxSize: options.maxSize
  });
}

export class SyncedPixelDocument extends SyncedDocument<PixelDocument> {
  readonly document: PixelDocument;

  constructor(
    room: PixelArtRoom,
    options: SyncedPixelDocumentOptions = {}
  ) {
    const document = blankPixelDocument(options);
    super(new PixelSyncClient({
      room,
      document
    }));
    this.document = document;
  }
}

export interface PixelArtDocumentKind {
  readonly kind: typeof PIXEL_ART_KIND;
  createDocument(
    room: PixelArtRoom
  ): SyncedPixelDocument;
}

export function pixelArtDocumentKind(
  options: SyncedPixelDocumentOptions = {}
): PixelArtDocumentKind {
  return {
    kind: PIXEL_ART_KIND,
    createDocument: (room) => new SyncedPixelDocument(
      room,
      options
    )
  };
}
