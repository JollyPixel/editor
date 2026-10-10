// Import Third-party Dependencies
import {
  RoomGrants,
  type GrantsRoom
} from "@jolly-pixel/network/client";
import type { PixelCommandAction } from "@jolly-pixel/asset.pixel-art/client";

// Import Internal Dependencies
import type { PixelDrawPanel } from "../panel/PixelDrawPanel.ts";
import {
  PIXEL_ART_CAPABILITIES,
  type PixelArtCapability
} from "./PixelArtAccess.ts";

// CONSTANTS
const kRefusedMessage = "You can only view this texture, so the change was not saved";

export type AccessPanel = Pick<PixelDrawPanel, "updateTexture" | "announce">;

export class RoomAccess {
  readonly #grants: RoomGrants<PixelCommandAction, PixelArtCapability>;

  constructor(
    room: GrantsRoom,
    panel: AccessPanel,
    textureId: string
  ) {
    this.#grants = new RoomGrants(room, PIXEL_ART_CAPABILITIES);
    this.#grants.on("change", (access) => {
      panel.updateTexture(textureId, { access });
    });
    this.#grants.on("denied", () => panel.announce(kRefusedMessage));
    panel.updateTexture(textureId, { access: this.#grants.current });
  }

  dispose(): void {
    this.#grants.dispose();
  }
}
