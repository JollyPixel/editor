// Import Third-party Dependencies
import * as THREE from "three";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import { ResizeHandle } from "@jolly-pixel/resize-handle";

// Import Internal Dependencies
import { CameraBehavior } from "./components/Camera.ts";
import { CubeFactory } from "./components/CubeFactory.ts";
import { OrbitControlsBehavior } from "./components/OrbitControlsBehavior.ts";
import { type PixelDrawPanel } from "./ui/PixelDrawPanel.ts";
import { CubeGallery } from "./CubeGallery.ts";
import { CubePicker } from "./CubePicker.ts";

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

  // One test cube per UV region, kept in sync via the uv event stream (see
  // CubeGallery.ts). Actor creation/teardown is delegated to CubeFactory, and
  // click-to-select raycasting to CubePicker, so CubeGallery itself only
  // owns the region↔cube mirroring/layout — not the ECS world or 3D input.
  const cubeFactory = new CubeFactory({ world, canvasTexture });
  const cubeGallery = new CubeGallery({ cubeFactory, canvasManager });
  new CubePicker({
    uv: canvasManager.uv,
    camera: cameraBehavior.camera,
    canvas,
    getMeshes: () => cubeGallery.meshes
  });

  canvasManager.onBufferUpdated = (event) => {
    if (event.action === "texture-replaced") {
      canvasTexture.image = canvasManager.textureCanvas();
      canvasTexture.needsUpdate = true;
      cubeGallery.refreshTextureSize();
    }
  };

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
