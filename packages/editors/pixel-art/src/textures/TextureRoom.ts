// Import Third-party Dependencies
import {
  PixelCollaboration,
  type PixelArtRoom
} from "@jolly-pixel/asset.pixel-art/client";
import type {
  PixelArtCanvas,
  UVRegion
} from "@jolly-pixel/pixel-draw.renderer";
import { peerProfileColor } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import {
  RoomAccess,
  type AccessPanel
} from "../access/RoomAccess.ts";

export interface TextureRoomOptions {
  room: PixelArtRoom;
  canvas: PixelArtCanvas;
  panel: AccessPanel;
  textureId: string;
  onRemoteUvDragging?: (region: UVRegion) => void;
}

export class TextureRoom {
  readonly #collaboration: PixelCollaboration;
  readonly #access: RoomAccess;

  constructor(
    options: TextureRoomOptions
  ) {
    const {
      room,
      canvas,
      panel,
      textureId,
      onRemoteUvDragging
    } = options;

    this.#collaboration = new PixelCollaboration({
      room,
      canvas,
      color: peerProfileColor,
      onRemoteUvDragging
    });
    this.#access = new RoomAccess(room, panel, textureId);
  }

  dispose(): void {
    this.#collaboration.destroy();
    this.#access.dispose();
  }
}
