// Import Third-party Dependencies
import {
  GolemAsset,
  type AssetOpening
} from "@jolly-pixel/golem.kit";
import type { PeerMetadata } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { SyncedPixelDocument } from "../network/client.ts";
import type {
  PixelArtEditableKind,
  PixelEditCommand
} from "../network/server.ts";
import { pixelCursor } from "./pixelCursor.ts";
import {
  PixelSurface,
  type PixelArtSummary
} from "./PixelSurface.ts";

export class PixelArtAsset extends GolemAsset<
  PixelEditCommand,
  SyncedPixelDocument
> {
  readonly pixels: PixelSurface;

  constructor(
    opening: AssetOpening,
    kind: PixelArtEditableKind
  ) {
    super(opening, kind);
    this.pixels = new PixelSurface(
      this.synced.document,
      (commands) => this.applyInBatches(commands)
    );
  }

  read(): PixelArtSummary {
    return this.pixels.summary();
  }

  protected focus(
    commands: readonly PixelEditCommand[]
  ): PeerMetadata | null {
    return pixelCursor(commands);
  }
}
