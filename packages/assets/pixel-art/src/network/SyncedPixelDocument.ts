// Import Third-party Dependencies
import type { Room } from "@jolly-pixel/network/client";
import {
  PixelDocument,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PIXEL_ART_KIND } from "../asset/kind.ts";
import { PixelSyncClient } from "./PixelSyncClient.ts";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "./types.ts";

// CONSTANTS
const kInitialSize: Vec2 = { x: 1, y: 1 };

export interface SyncedPixelDocumentOptions {
  maxSize?: number;
  history?: {
    enabled?: boolean;
    limit?: number;
  };
}

export class SyncedPixelDocument {
  readonly document: PixelDocument;
  readonly sync: PixelSyncClient;
  readonly ready: Promise<void>;

  constructor(
    room: Room<PixelNetworkCommand, PixelServerMessage>,
    options: SyncedPixelDocumentOptions = {}
  ) {
    this.document = new PixelDocument({
      size: kInitialSize,
      maxSize: options.maxSize,
      history: options.history
    });
    this.sync = new PixelSyncClient({
      room,
      document: this.document
    });
    this.ready = new Promise((resolve) => {
      this.sync.once("ready", resolve);
    });
  }

  dispose(): void {
    this.sync.destroy();
  }
}

export interface PixelArtDocumentKind {
  readonly kind: typeof PIXEL_ART_KIND;
  createDocument(
    room: Room<PixelNetworkCommand, PixelServerMessage>
  ): SyncedPixelDocument;
}

export function pixelArtDocumentKind(
  options: SyncedPixelDocumentOptions = {}
): PixelArtDocumentKind {
  return {
    kind: PIXEL_ART_KIND,
    createDocument: (room) => new SyncedPixelDocument(room, options)
  };
}
