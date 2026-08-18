// Import Third-party Dependencies
import * as network from "@jolly-pixel/network/client";
import {
  PixelCursorSync,
  PixelStrokeGhostSync,
  PixelSyncClient,
  SelectionGhostSync,
  UVGhostSync,
  type PixelArtCanvas,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";
import {
  LocalStorageAdapter,
  resolveStoredPrompt
} from "@jolly-pixel/ui";

// CONSTANTS
const kDemoRoom = "pixel-draw:demo-canvas";
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
    identity: {
      username: await resolveUsername()
    }
  });
  // E2E tests override this via ?room=... so each Playwright worker gets
  // its own isolated sync room instead of racing on the shared demo one.
  const roomId = new URLSearchParams(
    window.location.search
  ).get("room") ?? kDemoRoom;
  const room = networkClient.room<PixelNetworkCommand, PixelServerMessage>(
    roomId
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
