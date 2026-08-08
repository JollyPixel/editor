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
import { CanvasTextureRefreshBehavior } from "./preview/CanvasTextureRefreshBehavior.ts";
import { RegionPreviewFactory } from "./preview/RegionPreviewFactory.ts";
import { RegionPreviewGallery } from "./preview/RegionPreviewGallery.ts";
import { RegionPreviewPicker } from "./preview/RegionPreviewPicker.ts";

// CONSTANTS
const kStarterRegionId = "pixel-draw-demo:starter-region";
const kStarterRegionSize = 16;

interface SceneAppearance {
  backgroundColor: THREE.ColorRepresentation;
  borderColor: THREE.ColorRepresentation;
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

const runtime = await initRuntime();
loadRuntime(runtime, {
  focusCanvas: false
}).catch(console.error);

async function initRuntime(): Promise<Runtime> {
  const canvas = document.querySelector<HTMLCanvasElement>(
    "#canvas-container > canvas"
  )!;

  const runtime = await Runtime.create(canvas, {
    includePerformanceStats: false
  });

  const { world } = runtime;

  const scene = world.sceneManager.getSource();

  scene.add(
    new THREE.HemisphereLight(0xffffff, 0x76848c, 2.8)
  );

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

  const canvasTexture = new THREE.CanvasTexture(canvasManager.textureCanvas());
  canvasTexture.magFilter = THREE.NearestFilter;
  canvasTexture.minFilter = THREE.NearestFilter;
  world.createActor("preview-texture-refresh")
    .addComponentAndGet(CanvasTextureRefreshBehavior, { canvasTexture });

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

  // Attach sync before the gallery so initial UV region events are captured.
  const syncReady = initializeDemoSync(canvasManager);

  const previewFactory = new RegionPreviewFactory({ world, canvasTexture });
  previewGallery = new RegionPreviewGallery({
    previewFactory,
    canvasManager
  });
  const rotationToggle = document.querySelector<HTMLInputElement>(
    "#rotation-toggle"
  )!;
  rotationToggle.addEventListener("change", () => {
    previewGallery.setRotating(rotationToggle.checked);
  });
  previewGallery.setRotating(rotationToggle.checked);
  const themeController = new ThemeController({
    drawPanel,
    select: document.querySelector<HTMLSelectElement>("#theme-select")!,
    onResolvedThemeChange: (theme) => {
      const appearance = kSceneAppearances[theme];
      scene.background = new THREE.Color(appearance.backgroundColor);
      previewGallery.setAppearance({
        borderColor: appearance.borderColor
      });
    }
  });
  const previewPicker = new RegionPreviewPicker({
    uv: canvasManager.uv,
    camera: cameraBehavior.camera,
    canvas,
    getMeshes: () => previewGallery.meshes
  });
  window.addEventListener("beforeunload", () => {
    themeController.dispose();
    previewPicker.dispose();
    previewGallery.dispose();
  }, {
    once: true
  });

  await syncReady;
  initializeStarterRegion(canvasManager);

  world.renderer.on("resize", () => drawPanel.onResize());

  const resizeHandle = new ResizeHandle(drawPanel, { direction: "left" });
  resizeHandle.addEventListener("drag", () => {
    drawPanel.onResize();
  });
  resizeHandle.addEventListener("dragEnd", () => {
    drawPanel.onResize();
  });

  return runtime;
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
    width: kStarterRegionSize,
    height: kStarterRegionSize
  });
  canvasManager.uv.select(region.id);
}
