// Import Third-party Dependencies
import * as THREE from "three";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import { ResizeHandle } from "@jolly-pixel/resize-handle";
import * as network from "@jolly-pixel/network/client";
import {
  PixelSyncClient,
  PixelCursorSync,
  type PixelNetworkCommand,
  type PixelServerMessage,
  type PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  PixelDrawPanel,
  type ThemeMode
} from "../../src/index.ts";
import { CameraBehavior } from "./components/Camera.ts";
import { CubeFactory } from "./components/CubeFactory.ts";
import { OrbitControlsBehavior } from "./components/OrbitControlsBehavior.ts";
import { CubeGallery } from "./CubeGallery.ts";
import { CubePicker } from "./CubePicker.ts";

// Shared room config for multi-tab collaboration. Must match vite.config.ts.
const DEMO_ROOM = "pixel-draw:demo-canvas";
const USERNAME_STORAGE_KEY = "pixel-draw-demo:username";

const kDarkThemeQuery = "(prefers-color-scheme: dark)";
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
declare global {
  interface Window {
    /**
     * Test hook: true after PixelSyncClient "ready" applies the initial snapshot.
     */
    __pixelSyncReady?: boolean;
  }
}

const runtime = await initRuntime();
loadRuntime(runtime, {
  focusCanvas: false
}).catch(console.error);

/**
 * Lets the demo exercise all three theme values live, independent of
 * runtime/canvas init below. Also mirrors the choice onto <html data-theme>
 * so demo-only chrome outside the panel's shadow DOM (resize handle, this
 * select, the page backdrop — see public/main.css) follows along; that CSS
 * can't see pixel-draw-panel's own custom properties.
 */
function wireThemeSelect(
  onResolvedThemeChange: (theme: Exclude<ThemeMode, "auto">) => void
): void {
  const themeSelect = document.querySelector<HTMLSelectElement>("#theme-select")!;
  const drawPanel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
  const prefersDarkQuery = window.matchMedia(kDarkThemeQuery);

  function applyTheme(): void {
    const theme = themeSelect.value as ThemeMode;
    let resolvedTheme: Exclude<ThemeMode, "auto">;

    if (theme === "auto") {
      resolvedTheme = prefersDarkQuery.matches ? "dark" : "light";
    }
    else {
      resolvedTheme = theme;
    }

    drawPanel.theme = theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.resolvedTheme = resolvedTheme;
    onResolvedThemeChange(resolvedTheme);
  }

  themeSelect.addEventListener("change", applyTheme);
  prefersDarkQuery.addEventListener("change", () => {
    if (themeSelect.value === "auto") {
      applyTheme();
    }
  });
  applyTheme();
}

async function initRuntime(): Promise<Runtime> {
  const canvas = document.querySelector<HTMLCanvasElement>(
    "#canvas-container > canvas"
  )!;

  const runtime = await Runtime.create(canvas, {
    includePerformanceStats: false
  });

  const { world } = runtime;

  const scene = world.sceneManager.getSource();
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(5, 10, 7);

  // Cool fill light to keep non-key-facing cube faces readable while orbiting.
  const fillLight = new THREE.DirectionalLight(0xaeccff, 0.5);
  fillLight.position.set(-6, 3, -4);

  scene.add(
    new THREE.HemisphereLight(0xffffff, 0x3a4750, 1.0),
    keyLight,
    fillLight
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

  // Forward declaration for onBufferUpdated closure.
  // eslint-disable-next-line prefer-const -- assigned once, after construction below
  let cubeGallery: CubeGallery;

  canvasManager.onBufferUpdated = (event) => {
    if (event.action === "texture-replaced") {
      canvasTexture.image = canvasManager.textureCanvas();
      canvasTexture.needsUpdate = true;
      cubeGallery.refreshTextureSize();
    }
  };

  // Attach sync before CubeGallery so initial UV region events are captured.
  const syncReady = initializeWebsocketTransport(canvasManager);

  // One cube per UV region; CubeGallery mirrors region state to scene meshes.
  const cubeFactory = new CubeFactory({ world, canvasTexture });
  cubeGallery = new CubeGallery({ cubeFactory, canvasManager });
  const rotationToggle = document.querySelector<HTMLInputElement>(
    "#rotation-toggle"
  )!;
  rotationToggle.addEventListener("change", () => {
    cubeGallery.setRotating(rotationToggle.checked);
  });
  cubeGallery.setRotating(rotationToggle.checked);
  wireThemeSelect((theme) => {
    const appearance = kSceneAppearances[theme];
    scene.background = new THREE.Color(appearance.backgroundColor);
    cubeGallery.setAppearance({
      borderColor: appearance.borderColor
    });
  });
  new CubePicker({
    uv: canvasManager.uv,
    camera: cameraBehavior.camera,
    canvas,
    getMeshes: () => cubeGallery.meshes
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

/**
 * Prompts once per browser session
 */
function resolveUsername(): string {
  const cached = sessionStorage.getItem(USERNAME_STORAGE_KEY);
  if (cached) {
    return cached;
  }

  // eslint-disable-next-line no-alert -- example-only UX, no dedicated UI needed here
  const entered = window.prompt("Choose a username for this session")?.trim();
  const username = entered && entered.length > 0 ?
    entered :
    "Guest";

  sessionStorage.setItem(USERNAME_STORAGE_KEY, username);

  return username;
}

// PixelSyncClient.attach() chains onto the current canvas onBufferUpdated handler.
function initializeWebsocketTransport(
  canvasManager: PixelArtCanvas
): Promise<void> {
  const networkClient = new network.Client({
    identity: {
      username: resolveUsername()
    }
  });
  const room = networkClient.room<PixelNetworkCommand, PixelServerMessage>(
    DEMO_ROOM
  );
  room.join();
  room.on("peer-joined", (event) => console.log(`[pixel-sync] peer joined: ${event.clientId}`));
  room.on("peer-left", (event) => console.log(`[pixel-sync] peer left: ${event.clientId}`));

  const syncClient = new PixelSyncClient({
    room
  });
  syncClient.attach(canvasManager);
  const syncReady = new Promise<void>((resolve) => {
    syncClient.on("ready", () => {
      window.__pixelSyncReady = true;
      resolve();
    });
  });

  const cursorSync = new PixelCursorSync({
    room
  });
  cursorSync.attach(canvasManager);

  return syncReady;
}
