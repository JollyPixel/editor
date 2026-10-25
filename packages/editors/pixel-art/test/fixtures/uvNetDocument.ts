// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  PixelBuffer,
  PixelDocumentState,
  type PixelDocumentEvent,
  type SavedUVNetData,
  type UVNetSet
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { UvNetDocument } from "../../src/uv/nets/UvNetLibrary.ts";

export class UvNetTestDocument
  extends Emitter<PixelDocumentEvent>
  implements UvNetDocument {
  readonly #state = new PixelDocumentState({
    buffer: new PixelBuffer({ size: { x: 1, y: 1 } }),
    onUvNetsChanged: () => this.emit("uv-nets-changed")
  });

  get uvNets(): UVNetSet {
    return this.#state.uvNets;
  }

  saveUvNet(
    net: SavedUVNetData
  ): void {
    this.#state.apply({
      action: "uv-net-saved",
      metadata: { net }
    });
  }

  deleteUvNet(
    id: string
  ): void {
    this.#state.apply({
      action: "uv-net-deleted",
      metadata: { id }
    });
  }

  changeDefaultUvNet(
    id: string | null
  ): void {
    this.#state.apply({
      action: "uv-net-default-changed",
      metadata: { id }
    });
  }
}
