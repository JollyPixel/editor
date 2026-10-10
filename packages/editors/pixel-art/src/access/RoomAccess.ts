// Import Third-party Dependencies
import { isPixelCommandAction } from "@jolly-pixel/asset.pixel-art/client";
import type {
  Room,
  RoomRejectionEvent
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { PixelDrawPanel } from "../panel/PixelDrawPanel.ts";
import { PixelArtAccess } from "./PixelArtAccess.ts";

// CONSTANTS
const kRefusedMessage = "You can only view this texture, so the change was not saved";

export type AccessRoom = Pick<Room, "clientId" | "can" | "on" | "off">;
export type AccessPanel = Pick<PixelDrawPanel, "updateTexture" | "announce">;

export class RoomAccess {
  readonly #room: AccessRoom;
  readonly #panel: AccessPanel;
  readonly #textureId: string;

  constructor(
    room: AccessRoom,
    panel: AccessPanel,
    textureId: string
  ) {
    this.#room = room;
    this.#panel = panel;
    this.#textureId = textureId;
    room.on("sync", this.#refresh);
    room.on("denied", this.#onDenied);
    if (room.clientId !== null) {
      this.#refresh();
    }
  }

  dispose(): void {
    this.#room.off("sync", this.#refresh);
    this.#room.off("denied", this.#onDenied);
  }

  readonly #refresh = (): void => {
    this.#panel.updateTexture(this.#textureId, {
      access: PixelArtAccess.fromRights(this.#room)
    });
  };

  readonly #onDenied = (
    event: RoomRejectionEvent
  ): void => {
    if (isPixelCommandAction(event.event)) {
      this.#panel.announce(kRefusedMessage);
    }
  };
}
