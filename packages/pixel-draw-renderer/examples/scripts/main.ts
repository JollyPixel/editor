// Import Third-party Dependencies
import * as THREE from "three";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import { ResizeHandle } from "@jolly-pixel/resize-handle";

// Import Internal Dependencies
import { CameraBehavior } from "./components/Camera.ts";
import { CubeBehavior } from "./components/Cube.ts";
import { type PixelDrawPanel } from "./ui/PixelDrawPanel.ts";

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
  scene.background = new THREE.Color("#e0f1fa");

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(5, 10, 7);
  scene.add(
    new THREE.AmbientLight(0xffffff, 1.5),
    dirLight
  );

  const drawPanel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
  const canvasManager = await drawPanel.initialize({
    texture: {
      size: { x: 16, y: 16 }
    },
    defaultMode: "paint",
    zoom: {
      default: 16,
      min: 1,
      max: 32,
      sensitivity: 1
    },
    brush: { size: 1 },
    history: {
      enabled: true
    }
  });

  const canvasTexture = new THREE.CanvasTexture(canvasManager.getTextureCanvas());
  canvasTexture.magFilter = THREE.NearestFilter;
  canvasTexture.minFilter = THREE.NearestFilter;

  world.createActor("camera")
    .addComponent(CameraBehavior);

  world.createActor("cube")
    .addComponent(CubeBehavior, { canvasTexture });

  world.renderer.on("resize", () => {
    drawPanel.onResize();
  });

  const resizeHandle = new ResizeHandle(drawPanel, { direction: "left" });
  resizeHandle.addEventListener("drag", () => {
    drawPanel.onResize();
  });
  resizeHandle.addEventListener("dragEnd", () => {
    drawPanel.onResize();
  });

  return runtime;
}
