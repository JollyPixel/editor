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
  type AssetRecord
} from "@jolly-pixel/asset";
// Register all jolly-* elements.
import "@jolly-pixel/ui";

// Import Internal Dependencies
import { editorState } from "./EditorState.ts";
import { EditorSidebar } from "./features/sidebar/EditorSidebar.ts";
import { EditorScene } from "./scene/EditorScene.ts";
import { parseVoxelWorld } from "./features/map-config/parseVoxelWorld.ts";
import {
  toPeerMetadata,
  type EditorIdentity
} from "./network/identity.ts";
import { resolveEditorIdentity } from "./network/resolveEditorIdentity.ts";
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

async function preloadTilesets(
  record: AssetRecord | null,
  manager: THREE.LoadingManager
): Promise<TilesetSource[]> {
  const source = await record?.text();
  const tilesets = source ? parseVoxelWorld(source).tilesets : [];

  return loadTilesets(
    tilesets.length > 0 ? tilesets : [kFallbackTileset],
    { manager }
  );
}

const runtime = await Runtime.create("#game-container > canvas", {
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
let identity: EditorIdentity | undefined;

if (!offline) {
  // Prompted before the socket opens: the username travels in the join request.
  identity = await resolveEditorIdentity();
  const catalog = await AssetCatalog.fetch();
  const textureRecord = catalog.firstOfKind("pixelart");
  worldRecord = catalog.firstOfKind("voxelmap");
  const networkClient = new network.Client({
    identity: toPeerMetadata(identity)
  });
  textureRoom = networkClient.room<PixelNetworkCommand, PixelServerMessage>(
    assetRoomName(textureRecord.kind, textureRecord.id.value)
  );
  worldRoom = networkClient.room<VoxelNetworkCommand, VoxelServerMessage>(
    assetRoomName(worldRecord.kind, worldRecord.id.value)
  );
}

const tilesets = await preloadTilesets(
  worldRecord,
  runtime.manager
);

const editorScene = new EditorScene(
  editorState,
  {
    defaultLayerName: "Ground",
    tilesets,
    voxelRoom: worldRoom,
    identity
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

const { vr, gridRenderer } = await editorScene.ready;
if (sidebar) {
  sidebar.vr = vr;
  sidebar.gridRenderer = gridRenderer;
}
