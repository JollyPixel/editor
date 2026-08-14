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

// Import Internal Dependencies
import { editorState } from "./EditorState.ts";
import { EditorSidebar } from "./ui/EditorSidebar.ts";
import { EditorScene } from "./scene/editor.ts";
import { LocalStoragePersistence } from "./lib/LocalStoragePersistence.ts";
import type { EventCanvasHoverChange } from "./ui/types.ts";

const canvas = document.querySelector<HTMLCanvasElement>(
  "#game-container > canvas"
);
if (!canvas) {
  throw new Error("Canvas element not found");
}

const runtime = await Runtime.create(canvas, {
  includePerformanceStats: false,
  focusCanvas: false
});
const { world } = runtime;

// One shared WebSocket (matching vite.config.ts's createWebSocketNetworkPlugin),
// multiplexing the texture (pixel-draw) and world (voxel) sync rooms.
const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const networkClient = new network.Client({
  url: `${wsProtocol}//${location.host}/ws-sync`
});
const textureRoom = networkClient.room<PixelNetworkCommand, PixelServerMessage>(
  "voxel-map:texture"
);
textureRoom.join();
const worldRoom = networkClient.room<VoxelNetworkCommand, VoxelServerMessage>(
  "voxel-map:world"
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
