// Import Third-party Dependencies
import {
  Runtime,
  loadRuntime
} from "@jolly-pixel/runtime";
import type * as THREE from "three";
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
  loadTilesets,
  type TilesetSource,
  type TilesetDefinition
} from "@jolly-pixel/voxel.renderer";
import {
  AssetCatalog,
  assetRoomName,
  assetSourceUrl,
  CATALOG_URL_PATH,
  type AssetRecord
} from "@jolly-pixel/asset";
// Register all jolly-* elements.
import "@jolly-pixel/ui";

// Import Internal Dependencies
import { editorState } from "./EditorState.ts";
import { EditorSidebar } from "./features/sidebar/EditorSidebar.ts";
import { EditorScene } from "./scene/EditorScene.ts";
import { parseVoxelWorld } from "./features/map-config/parseVoxelWorld.ts";
import type { EventCanvasHoverChange } from "./shared/dom.types.ts";
// Register editor icon glyphs.
import "./features/sidebar/icons.ts";

// CONSTANTS
// Used offline or when the shared document has no tileset.
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

// VoxelEngine.load() requires tileset textures to be resident.
async function preloadTilesets(
  record: AssetRecord | null,
  manager: THREE.LoadingManager
): Promise<TilesetSource[]> {
  if (record === null) {
    return loadTilesets([kFallbackTileset], { manager });
  }

  const response = await fetch(assetSourceUrl(record.source));
  if (!response.ok) {
    throw new Error(
      `Voxel-map document responded with ${response.status}.`
    );
  }

  const { tilesets } = parseVoxelWorld(await response.text());

  return loadTilesets(
    tilesets.length > 0 ? tilesets : [kFallbackTileset],
    { manager }
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

const tilesets = await preloadTilesets(worldRecord, runtime.manager);

const editorScene = new EditorScene(
  editorState,
  {
    defaultLayerName: "Ground",
    tilesets,
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
  skipLoadingScreen: true,
  maxFps: Infinity
});

// Wait for first-frame scene initialization.
const { vr, gridRenderer } = await editorScene.ready;
if (sidebar) {
  sidebar.vr = vr;
  sidebar.gridRenderer = gridRenderer;
}
