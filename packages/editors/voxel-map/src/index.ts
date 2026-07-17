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
import type { EventCanvasHoverChange } from "./ui/types.ts";

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

  // The pixel-art texture editor's own keybinds (Shift, Ctrl+C/V, Delete)
  // and the 3D viewport's WASD camera controls both listen document/window
  // -wide, so yield the engine's keyboard while the pointer is over the
  // drawing canvas to avoid the two colliding.
  sidebar.addEventListener("canvas-hover-change", (event: Event) => {
    const { hovering } = (event as EventCanvasHoverChange).detail;
    world.input.keyboard.setEnabled(!hovering);
  });
}

world.sceneManager.loadScene(editorScene);

loadRuntime(runtime, {
  focusCanvas: false
})
  .catch(console.error);
