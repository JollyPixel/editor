// Import Third-party Dependencies
import * as THREE from "three";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import { ResizeHandle } from "@jolly-pixel/resize-handle";
import Picker from "vanilla-picker";

// Import Internal Dependencies
import { CanvasManager } from "../../src/index.ts";
import { CameraBehavior } from "./components/Camera.ts";
import { CubeBehavior } from "./components/Cube.ts";

const runtime = initRuntime();
loadRuntime(runtime, {
  focusCanvas: false
}).catch(console.error);

function initRuntime(): Runtime {
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

  const drawPanel = document.getElementById("draw-panel") as HTMLDivElement;
  const canvasManager = new CanvasManager(drawPanel, {
    texture: {
      size: { x: 16, y: 16 }
    },
    defaultMode: "paint",
    zoom: {
      default: 16,
      min: 1,
      max: 32,
      sensitivity: 0.6
    },
    brush: { size: 8 }
  });

  const modePaintBtn = document.getElementById("mode-paint") as HTMLButtonElement;
  const modeMoveBtn = document.getElementById("mode-move") as HTMLButtonElement;

  function setMode(mode: "paint" | "move"): void {
    canvasManager.setMode(mode);
    modePaintBtn.classList.toggle("active", mode === "paint");
    modeMoveBtn.classList.toggle("active", mode === "move");
  }

  // Sync initial state with whatever defaultMode was passed to CanvasManager
  setMode(canvasManager.getMode());

  modePaintBtn.addEventListener("click", () => setMode("paint"));
  modeMoveBtn.addEventListener("click", () => setMode("move"));

  // === Color picker ===
  const colorSwatch = document.getElementById("color-swatch") as HTMLButtonElement;
  const picker = new Picker({
    parent: colorSwatch,
    popup: "bottom",
    alpha: true,
    editor: true,
    editorFormat: "hex",
    color: "#000000ff",
    onChange: (color) => {
      const hex = color.hex.slice(0, 7);
      const alpha = color.rgba[3];
      canvasManager.brush.setColorWithOpacity(hex, alpha);
      colorSwatch.style.background = color.rgbaString;
    }
  });

  // Sync picker when the user right-click-picks a color from the canvas
  drawPanel.addEventListener("colorpicked", ((e: CustomEvent) => {
    const { hex, opacity } = e.detail as { hex: string; opacity: number; };
    const alphaHex = Math.round(opacity * 255).toString(16).padStart(2, "0");
    picker.setColor(`${hex}${alphaHex}`, true);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    colorSwatch.style.background = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }) as EventListener);

  // === Toolbar wiring ===
  const brushSizeInput = document.getElementById("brush-size") as HTMLInputElement;
  const brushSizeDisplay = document.getElementById("brush-size-display") as HTMLSpanElement;

  brushSizeInput.addEventListener("input", () => {
    const size = parseInt(brushSizeInput.value, 10);
    canvasManager.brush.setSize(size);
    brushSizeDisplay.textContent = `${size}px`;
  });

  const canvasTexture = new THREE.CanvasTexture(canvasManager.getTextureCanvas());
  canvasTexture.magFilter = THREE.NearestFilter;
  canvasTexture.minFilter = THREE.NearestFilter;

  world.createActor("camera")
    .addComponent(CameraBehavior);

  world.createActor("cube")
    .addComponent(CubeBehavior, { canvasTexture });

  world.renderer.on("resize", () => {
    canvasManager.onResize();
  });

  const resizeHandle = new ResizeHandle(drawPanel, { direction: "left" });
  resizeHandle.addEventListener("drag", () => {
    canvasManager.onResize();
  });
  resizeHandle.addEventListener("dragEnd", () => {
    canvasManager.onResize();
  });

  return runtime;
}
