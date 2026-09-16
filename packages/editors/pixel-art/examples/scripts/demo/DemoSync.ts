// Import Third-party Dependencies
import * as network from "@jolly-pixel/network/client";
import {
  AssetCatalog,
  assetRoomName,
  type AssetRecord
} from "@jolly-pixel/asset";
import {
  PixelCollaboration,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "@jolly-pixel/asset.pixel-art/network/client.ts";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import {
  LocalStorageAdapter,
  resolveStoredPrompt
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  PixelDrawPanel,
  TextureAddRequestDetail
} from "../../../src/index.ts";
import { suggestTextureName } from "../../../src/ui/pixel-draw-panel/textures.ts";
import { DemoCatalog } from "./DemoCatalog.ts";

// CONSTANTS
const kDemoAssetPath = "demo-canvas.pixelart";
const kPixelArtKind = "pixelart";
const kAddDelayParam = "add-delay";
const kUsernameStorageKey = "pixel-draw-demo:username";
const kUsernameStorage = new LocalStorageAdapter({
  resolve: () => sessionStorage
});

declare global {
  interface Window {
    __pixelSyncReady?: boolean;
    /**
     * Texture ids whose sync room delivered its first snapshot.
     */
    __pixelSyncReadyTextures?: string[];
  }
}

interface BoundTexture {
  room: network.Room<PixelNetworkCommand, PixelServerMessage>;
  collaboration: PixelCollaboration;
}

export async function initializeDemoSync(
  panel: PixelDrawPanel
): Promise<void> {
  const networkClient = new network.Client({
    profile: {
      username: await resolveUsername()
    }
  });
  const assetPath = new URLSearchParams(
    window.location.search
  ).get("asset") ?? kDemoAssetPath;
  const record = await resolveCanvasAsset(assetPath);

  const textureId = panel.activeTextureId;
  const canvas = panel.canvasManager;
  if (textureId === null || canvas === null) {
    throw new Error("The pixel-draw panel is not initialized.");
  }

  panel.renameTexture(textureId, suggestTextureName(record.source));
  const textures = new DemoTextures(panel, networkClient);
  await textures.bind(textureId, record.id.value, canvas);
  window.__pixelSyncReady = true;
}

class DemoTextures {
  readonly #panel: PixelDrawPanel;
  readonly #client: network.Client;
  readonly #catalog: DemoCatalog;
  readonly #bound = new Map<string, BoundTexture>();

  constructor(
    panel: PixelDrawPanel,
    client: network.Client
  ) {
    this.#panel = panel;
    this.#client = client;
    this.#catalog = new DemoCatalog(client);

    panel.addEventListener("texture-add-request", (event) => {
      event.detail.respondWith(this.#add(event.detail));
    });
    panel.addEventListener("texture-close-request", (event) => {
      this.#close(event.detail.id);
    });
  }

  bind(
    textureId: string,
    assetId: string,
    canvas: PixelArtCanvas
  ): Promise<void> {
    const room = this.#client.room<PixelNetworkCommand, PixelServerMessage>(
      assetRoomName(kPixelArtKind, assetId)
    );
    room.join();
    room.on("peer-joined", (event) => {
      console.log(`[pixel-sync] peer joined: ${event.clientId}`);
    });
    room.on("peer-left", (event) => {
      console.log(`[pixel-sync] peer left: ${event.clientId}`);
    });

    const collaboration = new PixelCollaboration({
      room,
      canvas
    });
    this.#bound.set(textureId, {
      room,
      collaboration
    });

    const { promise, resolve } = Promise.withResolvers<void>();
    collaboration.sync.on("ready", () => {
      window.__pixelSyncReadyTextures = [
        ...(window.__pixelSyncReadyTextures ?? []),
        textureId
      ];
      resolve();
    });

    return promise;
  }

  async #add(
    detail: TextureAddRequestDetail
  ): Promise<void> {
    const { name, source } = detail;
    try {
      await holdAdd();
      const { assetId, path } = await this.#catalog.createPixelArt(name, source);
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

  #close(
    textureId: string
  ): void {
    const bound = this.#bound.get(textureId);
    if (bound !== undefined) {
      bound.collaboration.destroy();
      bound.room.leave();
      this.#bound.delete(textureId);
    }

    this.#panel.removeTexture(textureId);
  }
}

async function resolveCanvasAsset(
  assetPath: string
): Promise<AssetRecord> {
  const catalog = await AssetCatalog.fetch();
  const record = Array.from(catalog.byKind("pixelart")).find(
    (entry) => entry.source === assetPath
  );
  if (record === undefined) {
    throw new Error(`No pixel-art asset at "${assetPath}".`);
  }

  return record;
}

function holdAdd(): Promise<void> {
  const value = Number(
    new URLSearchParams(window.location.search).get(kAddDelayParam)
  );
  if (!Number.isFinite(value) || value <= 0) {
    return Promise.resolve();
  }

  const { promise, resolve } = Promise.withResolvers<void>();
  window.setTimeout(resolve, value);

  return promise;
}

function resolveUsername(): Promise<string> {
  return resolveStoredPrompt({
    title: "Join pixel-draw demo",
    label: "Username",
    confirmLabel: "Join",
    storage: kUsernameStorage,
    storageKey: kUsernameStorageKey,
    fallbackValue: "Guest"
  });
}
