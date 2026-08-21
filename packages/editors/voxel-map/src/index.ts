// Import Third-party Dependencies
import {
  Runtime,
  loadRuntime
} from "@jolly-pixel/runtime";
import { ResizeHandle } from "@jolly-pixel/resize-handle";
import * as network from "@jolly-pixel/network/client";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "@jolly-pixel/voxel.renderer/network/client.ts";
import { TilesetLoader } from "@jolly-pixel/voxel.renderer";
import {
  AssetCatalog,
  assetRoomName,
  CATALOG_URL_PATH,
  type AssetRecord
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import { editorState } from "./EditorState.ts";
import { EditorSidebar } from "./ui/EditorSidebar.ts";
import { EditorScene } from "./scene/editor.ts";
import { LocalStoragePersistence } from "./lib/LocalStoragePersistence.ts";
import type { EventCanvasHoverChange } from "./ui/types.ts";

async function fetchAssetCatalog(): Promise<AssetCatalog> {
  const response = await fetch(CATALOG_URL_PATH);
  if (!response.ok) {
    throw new Error(
      `Asset catalog responded with ${response.status}.`
    );
  }

  return AssetCatalog.parse(await response.json());
}

function firstRecordOfKind(
  catalog: AssetCatalog,
  kind: string
): AssetRecord {
  for (const record of catalog) {
    if (record.kind === kind) {
      return record;
    }
  }

  throw new Error(
    `The asset workspace holds no "${kind}" document.`
  );
}

const canvas = document.querySelector<HTMLCanvasElement>(
  "#game-container > canvas"
);
if (!canvas) {
  throw new Error("Canvas element not found");
}

const runtime = await Runtime.create(canvas, {
  includePerformanceStats: {
    position: "top-right"
  },
  focusCanvas: false
});
const { world } = runtime;

// Rooms are named after the assets the back-end catalogs, so the ids come
// from the catalog rather than being hardcoded on both ends.
const catalog = await fetchAssetCatalog();
const textureRecord = firstRecordOfKind(catalog, "pixelart");
const worldRecord = firstRecordOfKind(catalog, "voxelmap");

// One shared WebSocket (matching vite.config.ts's createWebSocketNetworkPlugin),
// multiplexing the texture (pixel-draw) and world (voxel) sync rooms.
const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const networkClient = new network.Client({
  url: `${wsProtocol}//${location.host}/ws-sync`
});
const textureRoom = networkClient.room<PixelNetworkCommand, PixelServerMessage>(
  assetRoomName(textureRecord.kind, textureRecord.id.value)
);
textureRoom.join();
const worldRoom = networkClient.room<VoxelNetworkCommand, VoxelServerMessage>(
  assetRoomName(worldRecord.kind, worldRecord.id.value)
);
worldRoom.join();

const defaultTileset = {
  id: "default",
  src: "textures/tileset.png",
  tileSize: 32
};
const pendingLoad = worldRoom ? null : LocalStoragePersistence.load();
const tilesetLoader = new TilesetLoader({ manager: runtime.manager });
if (pendingLoad !== null) {
  await tilesetLoader.fromWorld(pendingLoad);
}
await tilesetLoader.fromTileDefinition(defaultTileset);

const editorScene = new EditorScene(
  editorState,
  {
    defaultLayerName: "Ground",
    tilesetLoader,
    pendingLoad,
    voxelRoom: worldRoom
  }
);

const sidebar = document.querySelector<EditorSidebar>("#sidebar")!;
if (sidebar) {
  sidebar.textureRoom = textureRoom;
  sidebar.onLoadWorld = (data) => editorScene.loadWorld(data);

  // editorScene.vr / gridRenderer are assigned inside awake(), which runs
  // after loadScene(). Defer propagating them to the sidebar until the block
  // registry is fully populated (dispatched at the end of awake()).
  editorState.addEventListener("blockRegistryChanged", () => {
    sidebar.vr = editorScene.vr;
    sidebar.gridRenderer = editorScene.gridRenderer;
  }, { once: true });

  new ResizeHandle(
    sidebar,
    { direction: "left" }
  );

  // The pixel-art texture editor's own keybinds (Shift, Ctrl+C/V, Delete)
  // and the 3D viewport's WASD camera controls both listen document/window
  // -wide, so yield the engine's keyboard while the pointer is over the
  // drawing canvas to avoid the two colliding.
  sidebar.addEventListener("canvas-hover-change", (event: Event) => {
    const { hovering } = (event as EventCanvasHoverChange).detail;
    world.input.keyboard.setEnabled(!hovering);
  });
}

loadRuntime(runtime, {
  scene: editorScene
})
  .catch(console.error);
