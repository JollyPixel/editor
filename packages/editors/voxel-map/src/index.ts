// Import Third-party Dependencies
import {
  Runtime,
  loadRuntime
} from "@jolly-pixel/runtime";
import { ResizeHandle } from "@jolly-pixel/resize-handle";

// Import Internal Dependencies
import { editorState } from "./EditorState.ts";
import { EditorSidebar } from "./ui/EditorSidebar.ts";
import { EditorScene } from "./scene/editor.ts";

const canvas = document.querySelector<HTMLCanvasElement>(
  "#game-container > canvas"
);
if (!canvas) {
  throw new Error("Canvas element not found");
}

const runtime = new Runtime(canvas, {
  includePerformanceStats: true
});
const { world } = runtime;

const editorScene = new EditorScene(
  editorState,
  {
    defaultLayerName: "Ground",
    defaultTileset: {
      id: "default",
      src: "textures/tileset.png",
      tileSize: 32
    }
  }
);

const sidebar = document.querySelector<EditorSidebar>("#sidebar")!;
if (sidebar) {
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
}

world.sceneManager.loadScene(editorScene);

loadRuntime(runtime, {
  focusCanvas: false
})
  .catch(console.error);
