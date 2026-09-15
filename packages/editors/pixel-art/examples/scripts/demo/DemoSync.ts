// Import Third-party Dependencies
import * as network from "@jolly-pixel/network/client";
import {
  AssetCatalog,
  assetRoomName,
  type AssetRecord
} from "@jolly-pixel/asset";
import {
  PixelCursorSync,
  PixelStrokeGhostSync,
  PixelSyncClient,
  SelectionGhostSync,
  UVGhostSync,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "@jolly-pixel/asset.pixel-art/network/client.ts";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import {
  LocalStorageAdapter,
  resolveStoredPrompt
} from "@jolly-pixel/ui";

// CONSTANTS
const kDemoAssetPath = "demo-canvas.pixelart";
const kUsernameStorageKey = "pixel-draw-demo:username";
const kUsernameStorage = new LocalStorageAdapter({
  resolve: () => sessionStorage
});

declare global {
  interface Window {
    /** Set after the initial collaboration snapshot is applied. */
    __pixelSyncReady?: boolean;
  }
}

export async function initializeDemoSync(
  canvasManager: PixelArtCanvas
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
  const room = networkClient.room<PixelNetworkCommand, PixelServerMessage>(
    assetRoomName(record.kind, record.id.value)
  );
  room.join();
  room.on("peer-joined", (event) => {
    console.log(`[pixel-sync] peer joined: ${event.clientId}`);
  });
  room.on("peer-left", (event) => {
    console.log(`[pixel-sync] peer left: ${event.clientId}`);
  });

  const syncClient = new PixelSyncClient({ room });
  syncClient.attach(canvasManager);
  const {
    promise: syncReady,
    resolve: resolveSyncReady
  } = Promise.withResolvers<void>();
  syncClient.on("ready", () => {
    window.__pixelSyncReady = true;
    resolveSyncReady();
  });

  const cursorSync = new PixelCursorSync({ room });
  cursorSync.attach(canvasManager);

  const strokeGhostSync = new PixelStrokeGhostSync({ room });
  strokeGhostSync.attach(canvasManager);

  const uvGhostSync = new UVGhostSync({ room });
  uvGhostSync.attach(canvasManager);

  const selectionGhostSync = new SelectionGhostSync({ room });
  selectionGhostSync.attach(canvasManager);

  return syncReady;
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
