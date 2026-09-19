// Import Third-party Dependencies
import {
  PixelCollaboration,
  type PixelArtRoom
} from "@jolly-pixel/asset.pixel-art/network/client.ts";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import {
  peerProfileColor,
  readUsername
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type {
  PixelDrawPanel,
  TextureAddRequestDetail,
  TextureCloseRequestDetail
} from "../../../src/index.ts";
import type { DemoSession } from "./DemoSession.ts";

export interface DemoTexturesOptions {
  panel: PixelDrawPanel;
  session: DemoSession;
  addDelay: number;
}

interface BoundTexture {
  room: PixelArtRoom;
  collaboration: PixelCollaboration;
}

export class DemoTextures {
  readonly #panel: PixelDrawPanel;
  readonly #session: DemoSession;
  readonly #addDelay: number;
  readonly #bound = new Map<string, BoundTexture>();
  readonly #synced = new Set<string>();

  constructor(
    options: DemoTexturesOptions
  ) {
    this.#panel = options.panel;
    this.#session = options.session;
    this.#addDelay = options.addDelay;

    this.#panel.addEventListener("texture-add-request", this.#onAddRequest);
    this.#panel.addEventListener("texture-close-request", this.#onCloseRequest);
  }

  isSynced(
    textureId: string
  ): boolean {
    return this.#synced.has(textureId);
  }

  bind(
    textureId: string,
    assetId: string,
    canvas: PixelArtCanvas
  ): Promise<void> {
    const room = this.#session.textureRoom(assetId);
    room.join();

    const collaboration = new PixelCollaboration({
      room,
      canvas,
      label: (_clientId, profile) => readUsername(profile),
      color: peerProfileColor
    });
    this.#bound.set(textureId, {
      room,
      collaboration
    });

    const { promise, resolve } = Promise.withResolvers<void>();
    collaboration.sync.on("ready", () => {
      this.#synced.add(textureId);
      resolve();
    });

    return promise;
  }

  dispose(): void {
    this.#panel.removeEventListener("texture-add-request", this.#onAddRequest);
    this.#panel.removeEventListener("texture-close-request", this.#onCloseRequest);
    for (const textureId of [...this.#bound.keys()]) {
      this.#unbind(textureId);
    }
  }

  readonly #onAddRequest = (
    event: CustomEvent<TextureAddRequestDetail>
  ): void => {
    event.detail.respondWith(this.#add(event.detail));
  };

  readonly #onCloseRequest = (
    event: CustomEvent<TextureCloseRequestDetail>
  ): void => {
    this.#unbind(event.detail.id);
    this.#panel.removeTexture(event.detail.id);
  };

  async #add(
    detail: TextureAddRequestDetail
  ): Promise<void> {
    const { name, source } = detail;
    try {
      await delay(this.#addDelay);
      const { assetId, path } = await this.#session.createPixelArt(name, source);
      const canvas = this.#panel.addTexture({
        id: assetId,
        name,
        tooltip: path,
        texture: {
          size: {
            x: source.width,
            y: source.height
          },
          init: source
        }
      });
      await this.bind(assetId, assetId, canvas);
    }
    catch (error) {
      console.error("[pixel-sync] could not add texture", error);
    }
  }

  #unbind(
    textureId: string
  ): void {
    const bound = this.#bound.get(textureId);
    if (bound === undefined) {
      return;
    }

    bound.collaboration.destroy();
    bound.room.leave();
    this.#bound.delete(textureId);
    this.#synced.delete(textureId);
  }
}

function delay(
  milliseconds: number
): Promise<void> {
  if (milliseconds <= 0) {
    return Promise.resolve();
  }

  const { promise, resolve } = Promise.withResolvers<void>();
  window.setTimeout(resolve, milliseconds);

  return promise;
}
