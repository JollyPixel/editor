// Import Third-party Dependencies
import type { RuntimeCanvasTarget } from "@jolly-pixel/runtime";
import { EditorRuntime } from "@jolly-pixel/editor.host";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import { LocalStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { PixelPreviewScene } from "../preview/PixelPreviewScene.ts";
import { ROTATION_STORAGE_KEY } from "../config.ts";

// CONSTANTS
const kStorage = new LocalStorageAdapter();

export interface DemoPreviewOptions {
  canvas: RuntimeCanvasTarget;
  canvasManager: PixelArtCanvas;
}

export interface DemoPreview {
  editorRuntime: EditorRuntime;
  scene: PixelPreviewScene;
}

export async function openDemoPreview(
  options: DemoPreviewOptions
): Promise<DemoPreview> {
  const scene = new PixelPreviewScene({
    canvasManager: options.canvasManager,
    rotating: kStorage.get(ROTATION_STORAGE_KEY) !== "false"
  });
  const editorRuntime = await EditorRuntime.create(options.canvas, {
    includePerformanceStats: false,
    focusCanvas: false,
    viewHelper: true
  });
  await editorRuntime.load(scene);
  await scene.ready;

  return {
    editorRuntime,
    scene
  };
}
