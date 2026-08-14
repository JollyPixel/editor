// Import Third-party Dependencies
import * as THREE from "three";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import { ResizeHandle } from "@jolly-pixel/resize-handle";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  PixelDrawPanel,
  type ThemeMode
} from "../../src/index.ts";
import { CameraBehavior } from "./components/Camera.ts";
import { OrbitControlsBehavior } from "./components/OrbitControlsBehavior.ts";
import { initializeDemoSync } from "./demo/DemoSync.ts";
import { ThemeController } from "./demo/ThemeController.ts";
import { RegionPreviewFactory } from "./preview/RegionPreviewFactory.ts";
import { RegionPreviewGallery } from "./preview/RegionPreviewGallery.ts";
import { RegionPreviewPicker } from "./preview/RegionPreviewPicker.ts";

// CONSTANTS
const kStarterRegionId = "pixel-draw-demo:starter-region";
const kStarterRegionSize = 16;
const kRotationStorageKey = "pixel-draw-demo:rotation";
const kThemeStorageKey = "pixel-draw-demo:theme";

interface SceneAppearance {
  backgroundColor: THREE.ColorRepresentation;
  borderColor: THREE.ColorRepresentation;
}

declare global {
  interface Window {
    /**
     * Preview meshes currently in the scene. Exposed for e2e: a region view
     * leaking a second mesh is invisible from the DOM.
     */
    __uvPreviewMeshCount?: () => number;
  }
}

function noop(): void {
  // No 3D runtime is active yet; scene-appearance updates are a no-op.
}

const kSceneAppearances: Record<Exclude<ThemeMode, "auto">, SceneAppearance> = {
  light: {
    backgroundColor: "#eef3f7",
    borderColor: "#101820"
  },
  dark: {
    backgroundColor: "#161a1d",
    borderColor: "#f2f5f7"
  }
};

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
  const canvasContainer = document.querySelector<HTMLDivElement>(
    "#canvas-container"
  )!;
  const runtime = await Runtime.create(canvas, {
    includePerformanceStats: false,
    focusCanvas: false
  });
  const runtimeReady = loadRuntime(runtime, {
    loadingContainer: canvasContainer
  });

  const { world } = runtime;

  const scene = world.sceneManager.getSource();

  scene.add(
    new THREE.HemisphereLight(0xffffff, 0x76848c, 2.8)
  );

  const canvasTexture = new THREE.CanvasTexture(canvasManager.textureCanvas());
  canvasTexture.magFilter = THREE.NearestFilter;
  canvasTexture.minFilter = THREE.NearestFilter;

  const cameraBehavior = world.createActor("camera")
    .addComponentAndGet(CameraBehavior);

  // Drag orbit + scroll zoom camera controls.
  world.createActor("orbit-controls").addComponentAndGet(OrbitControlsBehavior, {
    camera: cameraBehavior.camera,
    cameraActor: cameraBehavior.actor,
    target: new THREE.Vector3(0, 0, 0),
    minDistance: 3,
    maxDistance: 30
  });

  // Forward declaration for the texture update closure.
  // eslint-disable-next-line prefer-const -- assigned once, after construction below
  let previewGallery: RegionPreviewGallery;

  canvasManager.onBufferUpdated = (event) => {
    canvasTexture.needsUpdate = true;
    if (event.action === "texture-replaced") {
      canvasTexture.image = canvasManager.textureCanvas();
      previewGallery.refreshTextureSize();
    }
  };

  const previewFactory = new RegionPreviewFactory({
    world,
    canvasTexture
  });
  previewGallery = new RegionPreviewGallery({
    previewFactory,
    canvasManager
  });
  window.__uvPreviewMeshCount = () => previewGallery.meshes.length;
  rotationToggle.addEventListener("change", () => {
    previewGallery.setRotating(rotationToggle.checked);
    localStorage.setItem(kRotationStorageKey, String(rotationToggle.checked));
  });
  previewGallery.setRotating(rotationToggle.checked);
  applySceneAppearance = (theme) => {
    const appearance = kSceneAppearances[theme];
    scene.background = new THREE.Color(appearance.backgroundColor);
    previewGallery.setAppearance({
      borderColor: appearance.borderColor
    });
  };
  applySceneAppearance(
    resolveTheme(themeSelect.value as ThemeMode)
  );
  const previewPicker = new RegionPreviewPicker({
    uv: canvasManager.uv,
    camera: cameraBehavior.camera,
    canvas,
    getMeshes: () => previewGallery.meshes
  });
  window.addEventListener("beforeunload", () => {
    previewPicker.dispose();
    previewGallery.dispose();
  }, {
    once: true
  });

  await runtimeReady.catch(console.error);

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
