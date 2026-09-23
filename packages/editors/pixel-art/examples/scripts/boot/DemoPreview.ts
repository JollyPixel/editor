// Import Third-party Dependencies
import type { RuntimeCanvasTarget } from "@jolly-pixel/runtime";
import { EditorRuntime } from "@jolly-pixel/editor.host";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import { LocalStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { PixelPreviewScene } from "../preview/PixelPreviewScene.ts";

// CONSTANTS
const kRotationStorageKey = "pixel-draw-demo:rotation";
const kStorage = new LocalStorageAdapter();

export interface DemoPreviewOptions {
  canvas: RuntimeCanvasTarget;
  canvasManager: PixelArtCanvas;
  rotationToggle: HTMLInputElement;
}

export interface DemoPreview {
  editorRuntime: EditorRuntime;
  scene: PixelPreviewScene;
}

export async function openDemoPreview(
  options: DemoPreviewOptions
): Promise<DemoPreview> {
  const { rotationToggle } = options;
  const rotation = kStorage.get(kRotationStorageKey);
  if (rotation === "true" || rotation === "false") {
    rotationToggle.checked = rotation === "true";
  }

  const scene = new PixelPreviewScene({
    canvasManager: options.canvasManager,
    rotating: rotationToggle.checked
  });
  const editorRuntime = await EditorRuntime.create(options.canvas, {
    includePerformanceStats: false,
    focusCanvas: false,
    viewHelper: true
  });
  await editorRuntime.load(scene);
  await scene.ready;

  rotationToggle.addEventListener("change", () => {
    scene.setRotating(rotationToggle.checked);
    kStorage.set(kRotationStorageKey, String(rotationToggle.checked));
  });

  return {
    editorRuntime,
    scene
  };
}
