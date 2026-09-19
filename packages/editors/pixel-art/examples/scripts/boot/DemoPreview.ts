// Import Third-party Dependencies
import {
  Runtime,
  type RuntimeCanvasTarget
} from "@jolly-pixel/runtime";
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
  maxFps?: number;
}

export interface DemoPreview {
  runtime: Runtime;
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

  const runtime = await Runtime.create(options.canvas, {
    includePerformanceStats: false,
    focusCanvas: false,
    viewHelper: true
  });
  const scene = new PixelPreviewScene({
    canvasManager: options.canvasManager,
    rotating: rotationToggle.checked
  });
  await runtime.load({
    skipLoadingScreen: true,
    scene,
    maxFps: options.maxFps
  });
  await scene.ready;

  rotationToggle.addEventListener("change", () => {
    scene.setRotating(rotationToggle.checked);
    kStorage.set(kRotationStorageKey, String(rotationToggle.checked));
  });

  return {
    runtime,
    scene
  };
}
