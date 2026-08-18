// Import Third-party Dependencies
import {
  Runtime,
  loadRuntime
} from "@jolly-pixel/runtime";
import {
  ResizeHandle
} from "@jolly-pixel/resize-handle";
import type {
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  PixelDrawPanel,
  type ThemeMode
} from "../../src/index.ts";
import { initializeDemoSync } from "./demo/DemoSync.ts";
import { ThemeController } from "./demo/ThemeController.ts";
import { PixelPreviewScene } from "./preview/PixelPreviewScene.ts";

// CONSTANTS
const kStarterRegionId = "pixel-draw-demo:starter-region";
const kStarterRegionSize = 16;
const kRotationStorageKey = "pixel-draw-demo:rotation";
const kThemeStorageKey = "pixel-draw-demo:theme";

function noop(): void {
  // No 3D runtime is active yet; scene-appearance updates are a no-op.
}

await initRuntime();

async function initRuntime(): Promise<void> {
  const { rotationToggle, themeSelect } = restoreDemoPreferences();
  const drawPanel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
  const canvasManager = await drawPanel.initialize({
    texture: {
      size: {
        x: 80,
        y: 80
      }
    },
    defaultMode: "paint",
    zoom: {
      // No `default`: PixelArtCanvas computes a fit-to-panel initial zoom.
      min: 1,
      max: 32,
      sensitivity: 1
    },
    brush: {
      size: 1
    },
    history: {
      enabled: true
    }
  });

  const resizeHandle = new ResizeHandle(drawPanel, {
    direction: "left"
  });
  resizeHandle.addEventListener("drag", () => {
    drawPanel.onResize();
  });
  resizeHandle.addEventListener("dragEnd", () => {
    drawPanel.onResize();
  });

  // Theming applies to the 2D panel regardless of whether the 3D preview
  // runtime is running; only the scene-appearance side effect is 3D-only.
  let applySceneAppearance: (theme: Exclude<ThemeMode, "auto">) => void = noop;
  const themeController = new ThemeController({
    drawPanel,
    select: themeSelect,
    onResolvedThemeChange: (theme) => applySceneAppearance(theme)
  });
  themeSelect.addEventListener("change", () => {
    localStorage.setItem(
      kThemeStorageKey,
      themeSelect.value
    );
  });
  window.addEventListener("beforeunload", () => {
    themeController.dispose();
  }, {
    once: true
  });

  // The 3D preview runtime (camera, orbit controls, UV region meshes) is
  // pure overhead for tests that only exercise the 2D pixel canvas: its
  // WebGPU-fallback render loop runs continuously and competes with every
  // CDP-dispatched pointer event for the main thread. Tests that don't
  // assert on preview meshes skip it with `?runtime=off` (see gotoDemo()).
  if (new URLSearchParams(window.location.search).get("runtime") === "off") {
    const syncReady = initializeDemoSync(canvasManager);
    await syncReady;

    return;
  }

  const canvas = document.querySelector<HTMLCanvasElement>(
    "#canvas-container > canvas"
  )!;
  const runtime = await Runtime.create(canvas, {
    includePerformanceStats: false,
    focusCanvas: false
  });

  const previewScene = new PixelPreviewScene({
    canvasManager,
    initialRotating: rotationToggle.checked
  });
  const sceneReady = new Promise<void>((resolve) => {
    previewScene.once("awake", resolve);
  });
  const runtimeReady = loadRuntime(runtime, {
    skipLoadingScreen: true,
    scene: previewScene
  });
  window.addEventListener("beforeunload", () => {
    previewScene.destroy();
  }, {
    once: true
  });
  await Promise.all([
    runtimeReady.catch(console.error),
    sceneReady
  ]);

  rotationToggle.addEventListener("change", () => {
    previewScene.setRotating(rotationToggle.checked);
    localStorage.setItem(kRotationStorageKey, String(rotationToggle.checked));
  });
  applySceneAppearance = (theme) => previewScene.setAppearance(theme);
  applySceneAppearance(
    resolveTheme(themeSelect.value as ThemeMode)
  );

  const { world } = runtime;

  // The gallery is listening before sync restores the initial UV regions.
  const syncReady = initializeDemoSync(canvasManager);
  await syncReady;
  initializeStarterRegion(canvasManager);

  world.renderer.on("resize", () => drawPanel.onResize());
}

function restoreDemoPreferences(): {
  rotationToggle: HTMLInputElement;
  themeSelect: HTMLSelectElement;
} {
  const rotationToggle = document.querySelector<HTMLInputElement>(
    "#rotation-toggle"
  )!;
  const themeSelect = document.querySelector<HTMLSelectElement>(
    "#theme-select"
  )!;
  const rotation = localStorage.getItem(kRotationStorageKey);
  const theme = themeFromStorage(
    localStorage.getItem(kThemeStorageKey)
  );

  if (rotation === "true" || rotation === "false") {
    rotationToggle.checked = rotation === "true";
  }

  if (theme !== null) {
    themeSelect.value = theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.resolvedTheme = resolveTheme(theme);
  }

  return { rotationToggle, themeSelect };
}

function themeFromStorage(
  value: string | null
): ThemeMode | null {
  switch (value) {
    case "light":
    case "dark":
    case "auto":
      return value;
    default:
      return null;
  }
}

function resolveTheme(
  theme: ThemeMode
): Exclude<ThemeMode, "auto"> {
  if (theme !== "auto") {
    return theme;
  }

  return window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches ? "dark" : "light";
}

function initializeStarterRegion(
  canvasManager: PixelArtCanvas
): void {
  if (new URLSearchParams(window.location.search).has("empty")) {
    return;
  }

  const [existingRegion] = canvasManager.uv.regions;
  const region = existingRegion ?? canvasManager.uv.create({
    id: kStarterRegionId,
    name: "cube 0",
    width: kStarterRegionSize,
    height: kStarterRegionSize
  });
  canvasManager.uv.select(region.id);
}
