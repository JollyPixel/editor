// Import Third-party Dependencies
import * as THREE from "three";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import { ResizeHandle } from "@jolly-pixel/resize-handle";
import { NetworkClient } from "@jolly-pixel/network";

// Import Internal Dependencies
import type { PixelArtCanvas } from "../../src/index.ts";
import {
  PixelSyncSession,
  type PixelNetworkCommand,
  type PixelServerMessage
} from "../../src/network/index.ts";
import { CameraBehavior } from "./components/Camera.ts";
import { CubeFactory } from "./components/CubeFactory.ts";
import { OrbitControlsBehavior } from "./components/OrbitControlsBehavior.ts";
import { type PixelDrawPanel } from "./ui/PixelDrawPanel.ts";
import { CubeGallery } from "./CubeGallery.ts";
import { CubePicker } from "./CubePicker.ts";

// Every tab that opens this demo joins the same namespace, so pointing a
// collaborator at the same URL joins them onto the same canvas. Must match
// the PixelSyncServer's namespace in vite.config.ts.
const DEMO_NAMESPACE = "pixel-draw:demo-canvas";

declare global {
  interface Window {
    /**
     * Flips to `true` once the initial WS snapshot has been applied to the
     * canvas. examples/ isn't published (see package.json's "files"), so
     * this test-only hook is harmless to leave in: it lets the E2E suite
     * wait for a deterministic starting point (the server's current shared
     * buffer) before resetting it, instead of racing the snapshot.
     */
    __pixelSyncReady?: boolean;
  }
}

const runtime = await initRuntime();
loadRuntime(runtime, {
  focusCanvas: false
}).catch(console.error);

async function initRuntime(): Promise<Runtime> {
  const canvas = document.querySelector<HTMLCanvasElement>(
    "#canvas-container > canvas"
  )!;

  const runtime = new Runtime(canvas, {
    includePerformanceStats: false
  });

  const { world } = runtime;

  const scene = world.sceneManager.getSource();
  scene.background = new THREE.Color("#eef3f7");

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(5, 10, 7);

  // Cool-toned fill from the opposite side, so faces facing away from the
  // key light aren't flat black — matters now that orbiting lets every
  // face be seen (see OrbitControlsBehavior).
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
    backgroundColor: "#263238",
    zoom: {
      // No `default`: PixelArtCanvas computes one that fits the whole
      // texture inside the panel's initial size (see PixelArtCanvas.md).
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

  // Drag to orbit, scroll to zoom — lets every face of a cube actually be
  // inspected instead of only the two the static camera used to show.
  world.createActor("orbit-controls").addComponentAndGet(OrbitControlsBehavior, {
    camera: cameraBehavior.camera,
    target: new THREE.Vector3(0, 0, 0),
    minDistance: 3,
    maxDistance: 30
  });

  // Forward-declared: the onBufferUpdated handler below closes over it, but
  // only invokes it once "texture-replaced" fires, well after CubeGallery
  // (assigned below) exists.
  // eslint-disable-next-line prefer-const -- assigned once, after construction below
  let cubeGallery: CubeGallery;

  canvasManager.onBufferUpdated = (event) => {
    if (event.action === "texture-replaced") {
      canvasTexture.image = canvasManager.textureCanvas();
      canvasTexture.needsUpdate = true;
      cubeGallery.refreshTextureSize();
    }
  };

  // Must run before CubeGallery is constructed below: CubeGallery seeds an
  // initial UV region synchronously, and EditPipeline forwards that as a
  // "uv-region-created" onBufferUpdated event immediately (not queued) —
  // if sync isn't attached yet, the event fires into a void and the region
  // never reaches the server, so late-joining peers never see it either.
  initializeWebsocketTransport(canvasManager);

  // One test cube per UV region, kept in sync via the uv event stream (see
  // CubeGallery.ts). Actor creation/teardown is delegated to CubeFactory, and
  // click-to-select raycasting to CubePicker, so CubeGallery itself only
  // owns the region↔cube mirroring/layout — not the ECS world or 3D input.
  const cubeFactory = new CubeFactory({ world, canvasTexture });
  cubeGallery = new CubeGallery({ cubeFactory, canvasManager });
  new CubePicker({
    uv: canvasManager.uv,
    camera: cameraBehavior.camera,
    canvas,
    getMeshes: () => cubeGallery.meshes
  });

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

// PixelSyncSession.attach() chains onto whatever local `onBufferUpdated` handler the canvas already has.
function initializeWebsocketTransport(
  canvasManager: PixelArtCanvas
) {
  const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
  const client = new NetworkClient({
    url: `${wsProtocol}//${location.host}/ws-sync`
  });
  const transport = client.channel<PixelNetworkCommand, PixelServerMessage>(
    DEMO_NAMESPACE
  );
  transport.onPeerJoined = (peerId) => console.log(`[pixel-sync] peer joined: ${peerId}`);
  transport.onPeerLeft = (peerId) => console.log(`[pixel-sync] peer left: ${peerId}`);

  const session = new PixelSyncSession({ transport });
  session.attach(canvasManager);

  // Chains onto whatever handler session.attach() just installed, mirroring
  // its own onBufferUpdated chaining above — loadSnapshot() (triggered by a
  // "snapshot" message) bypasses onBufferUpdated entirely, so this is the
  // only way to observe it without touching PixelSyncSession itself.
  const previousOnMessage = transport.onMessage;
  transport.onMessage = (message) => {
    previousOnMessage?.(message);
    if (message.type === "snapshot") {
      window.__pixelSyncReady = true;
    }
  };
}
