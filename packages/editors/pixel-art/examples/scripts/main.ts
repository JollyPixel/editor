// Import Third-party Dependencies
import {
  Runtime,
  loadRuntime
} from "@jolly-pixel/runtime";
import {
  Dock,
  type ThemePreferences
} from "@jolly-pixel/ui";
import type {
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  PixelDrawPanel,
  type ThemeMode
} from "../../src/index.ts";
import { initializeDemoSync } from "./demo/DemoSync.ts";
import { PixelPreviewScene } from "./preview/PixelPreviewScene.ts";

// CONSTANTS
const kStarterRegionId = "pixel-draw-demo:starter-region";
const kStarterRegionSize = 16;
const kRotationStorageKey = "pixel-draw-demo:rotation";

function noop(): void {
  // No 3D runtime is active yet; scene-appearance updates are a no-op.
}

await initRuntime();

async function initRuntime(): Promise<void> {
  const rotationToggle = restoreDemoPreferences();
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

  const drawPanelDock = document.querySelector<Dock>("#draw-panel-dock")!;
  drawPanelDock.addEventListener("jolly-resize", () => {
    drawPanel.onResize();
  });
  drawPanelDock.addEventListener("jolly-resize-end", () => {
    drawPanel.onResize();
  });

  // jolly-theme-preferences owns the toggle and its persistence; setting
  // `target` after both elements exist re-applies it (ThemePreferences'
  // `updated()` hook), since `pixel-draw-panel` lives outside the preferences
  // element's own tree and can't be found via `.closest("jolly-scope")`.
  const themePreferences = document.querySelector<ThemePreferences>("#theme-preferences")!;
  themePreferences.target = drawPanel;
  await themePreferences.updateComplete;

  // Theming applies to the 2D panel regardless of whether the 3D preview
  // runtime is running; only the scene-appearance side effect is 3D-only.
  // `--color-*` (the panel's CSS) and `--demo-*` (the page backdrop's CSS)
  // both resolve "auto" on their own via `color-scheme`; only this resolved
  // value, needed by the non-CSS 3D scene, is main.ts's to compute.
  let applySceneAppearance: (theme: Exclude<ThemeMode, "auto">) => void = noop;
  function syncResolvedTheme(): void {
    const resolvedTheme = resolveTheme(drawPanel.theme);
    document.documentElement.dataset.theme = drawPanel.theme;
    document.documentElement.dataset.resolvedTheme = resolvedTheme;
    applySceneAppearance(resolvedTheme);
  }
  themePreferences.addEventListener("jolly-change", syncResolvedTheme);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (drawPanel.theme === "auto") {
      syncResolvedTheme();
    }
  });
  syncResolvedTheme();

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

  const runtime = await Runtime.create("#canvas-container > canvas", {
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
  syncResolvedTheme();

  const { world } = runtime;

  // The gallery is listening before sync restores the initial UV regions.
  const syncReady = initializeDemoSync(canvasManager);
  await syncReady;
  initializeStarterRegion(canvasManager);

  world.renderer.on("resize", () => drawPanel.onResize());
}

function restoreDemoPreferences(): HTMLInputElement {
  const rotationToggle = document.querySelector<HTMLInputElement>(
    "#rotation-toggle"
  )!;
  const rotation = localStorage.getItem(kRotationStorageKey);

  if (rotation === "true" || rotation === "false") {
    rotationToggle.checked = rotation === "true";
  }

  return rotationToggle;
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
