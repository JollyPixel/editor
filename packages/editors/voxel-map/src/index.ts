// Import Third-party Dependencies
import {
  Runtime,
  loadRuntime
} from "@jolly-pixel/runtime";
import * as network from "@jolly-pixel/network/client";
import type * as networkTypes from "@jolly-pixel/network";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "@jolly-pixel/voxel.renderer/network/client.ts";
import {
  TilesetLoader,
  type TilesetDefinition
} from "@jolly-pixel/voxel.renderer";
import {
  AssetCatalog,
  assetRoomName,
  assetSourceUrl,
  CATALOG_URL_PATH,
  type AssetRecord
} from "@jolly-pixel/asset";
// Registers every "jolly-*" element.
import "@jolly-pixel/ui";

// Import Internal Dependencies
import { editorState } from "./EditorState.ts";
import { EditorSidebar } from "./features/sidebar/EditorSidebar.ts";
import { EditorScene } from "./scene/EditorScene.ts";
import { parseVoxelWorld } from "./features/map-config/parseVoxelWorld.ts";
import type { EventCanvasHoverChange } from "./shared/dom.types.ts";
// Registers the editor's icon glyphs.
import "./features/sidebar/icons.ts";

// CONSTANTS
/** Used offline, and when the shared document declares no tileset of its own. */
const kFallbackTileset: TilesetDefinition = {
  id: "default",
  src: "textures/tileset.png",
  tileSize: 32
};

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

/**
 * Tileset textures must be resident before the first world snapshot reaches
 * `VoxelEngine.load()`, which refuses to register one it cannot find.
 */
async function preloadTilesets(
  loader: TilesetLoader,
  record: AssetRecord | null
): Promise<void> {
  if (record !== null) {
    const response = await fetch(assetSourceUrl(record.source));
    if (!response.ok) {
      throw new Error(
        `Voxel-map document responded with ${response.status}.`
      );
    }

    await loader.fromWorld(
      parseVoxelWorld(await response.text())
    );
  }

  if (loader.tilesets.size === 0) {
    await loader.fromTileDefinition(kFallbackTileset);
  }
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
const offline = new URLSearchParams(location.search).has("offline");
let worldRecord: AssetRecord | null = null;
let textureRoom: networkTypes.Room<PixelNetworkCommand, PixelServerMessage> | undefined;
let worldRoom: networkTypes.Room<VoxelNetworkCommand, VoxelServerMessage> | undefined;

if (!offline) {
  const catalog = await fetchAssetCatalog();
  const textureRecord = firstRecordOfKind(catalog, "pixelart");
  worldRecord = firstRecordOfKind(catalog, "voxelmap");
  const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
  const networkClient = new network.Client({
    url: `${wsProtocol}//${location.host}/ws-sync`
  });
  textureRoom = networkClient.room<PixelNetworkCommand, PixelServerMessage>(
    assetRoomName(textureRecord.kind, textureRecord.id.value)
  );
  worldRoom = networkClient.room<VoxelNetworkCommand, VoxelServerMessage>(
    assetRoomName(worldRecord.kind, worldRecord.id.value)
  );
}

const tilesetLoader = new TilesetLoader({ manager: runtime.manager });
await preloadTilesets(tilesetLoader, worldRecord);

const editorScene = new EditorScene(
  editorState,
  {
    defaultLayerName: "Ground",
    tilesetLoader,
    voxelRoom: worldRoom
  }
);

const sidebar = document.querySelector<EditorSidebar>("#sidebar")!;
if (sidebar) {
  sidebar.textureRoom = textureRoom;
  sidebar.onLoadWorld = (data) => editorScene.loadWorld(data);
  sidebar.addEventListener("canvas-hover-change", (event: Event) => {
    const { hovering } = (event as EventCanvasHoverChange).detail;
    world.input.keyboard.enabled = !hovering;
  });
}

await loadRuntime(runtime, {
  scene: editorScene,
  skipLoadingScreen: true
});

// The scene awakes on the first frame, after loadRuntime() has resolved.
const { vr, gridRenderer } = await editorScene.ready;
if (sidebar) {
  sidebar.vr = vr;
  sidebar.gridRenderer = gridRenderer;
}
