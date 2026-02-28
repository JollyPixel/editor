// Import Third-party Dependencies
import * as THREE from "three";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import { ResizeHandle } from "@jolly-pixel/resize-handle";
import Picker from "vanilla-picker";

// Import Internal Dependencies
import {
  CanvasManager,
  UVMap,
  type UVMapChangedDetail
} from "../../src/index.ts";
import { CameraBehavior } from "./components/Camera.ts";
import { CubeWithUV } from "./components/CubeWithUV.ts";
import { UVPanel } from "./components/UVPanel.ts";

// CONSTANTS
// Texture atlas: 3 cols × 2 rows → each face region is 1/3 wide × 0.5 tall
const kTexW = 24;
const kTexH = 16;
// BoxGeometry face order: +x, -x, +y, -y, +z, -z
const kFaceOrder = ["right", "left", "top", "bottom", "front", "back"] as const;

const runtime = initRuntime();
loadRuntime(runtime, {
  focusCanvas: false
}).catch(console.error);

function createUVMap(): UVMap {
  const uvMap = new UVMap();
  const w = 1 / 3;
  const h = 0.5;

  uvMap.add({
    id: "right",
    label: "Right",
    u: 0, v: 0, width: w, height: h, color: "#f44"
  });
  uvMap.add({
    id: "left",
    label: "Left",
    u: w, v: 0, width: w, height: h, color: "#4af"
  });
  uvMap.add({
    id: "top",
    label: "Top",
    u: 2 * w, v: 0, width: w, height: h, color: "#4f4"
  });
  uvMap.add({
    id: "bottom",
    label: "Bottom",
    u: 0, v: h, width: w, height: h, color: "#fa4"
  });
  uvMap.add({
    id: "front",
    label: "Front",
    u: w, v: h, width: w, height: h, color: "#a4f"
  });
  uvMap.add({
    id: "back",
    label: "Back",
    u: 2 * w, v: h, width: w, height: h, color: "#4ff"
  });

  return uvMap;
}

function rebuildUVs(
  geometries: THREE.BoxGeometry[],
  uvMap: UVMap
): void {
  for (const geometry of geometries) {
    const uvAttr = geometry.attributes.uv;

    kFaceOrder.forEach((id, faceIndex) => {
      const region = uvMap.get(id);
      const u = region?.u ?? 0;
      const v = region?.v ?? 0;
      const width = region?.width ?? 1;
      const height = region?.height ?? 1;

      // Canvas UV origin is top-left; Three.js UV origin is bottom-left → flip V
      const base = faceIndex * 4;
      // top-left
      uvAttr.setXY(base + 0, u, 1 - v);
      // top-right
      uvAttr.setXY(base + 1, u + width, 1 - v);
      // bottom-left
      uvAttr.setXY(base + 2, u, 1 - v - height);
      // bottom-right
      uvAttr.setXY(base + 3, u + width, 1 - v - height);
    });

    uvAttr.needsUpdate = true;
  }
}

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

  const uvMap = createUVMap();

  const canvasManager = new CanvasManager(drawPanel, {
    texture: {
      size: { x: kTexW, y: kTexH }
    },
    defaultMode: "paint",
    zoom: {
      default: 12,
      min: 1,
      max: 32,
      sensitivity: 0.6
    },
    brush: { size: 8 },
    uv: {
      map: uvMap
    }
  });

  // canvasManager.setTexture(preloadTexture(uvMap));

  // === Mode buttons ===
  const modePaintBtn = document.getElementById("mode-paint") as HTMLButtonElement;
  const modeMoveBtn = document.getElementById("mode-move") as HTMLButtonElement;
  const modeUVBtn = document.getElementById("mode-uv") as HTMLButtonElement;
  const paintControls = document.getElementById("paint-controls") as HTMLDivElement;
  const uvPanelEl = document.getElementById("uv-panel") as HTMLElement;

  function setMode(mode: "paint" | "move" | "uv"): void {
    canvasManager.setMode(mode);
    modePaintBtn.classList.toggle("active", mode === "paint");
    modeMoveBtn.classList.toggle("active", mode === "move");
    modeUVBtn.classList.toggle("active", mode === "uv");
    const inUV = mode === "uv";
    uvPanelEl.classList.toggle("visible", inUV);
    paintControls.style.display = inUV ? "none" : "";
  }

  // Sync initial state with whatever defaultMode was passed to CanvasManager
  setMode(canvasManager.getMode() as "paint" | "move" | "uv");

  modePaintBtn.addEventListener("click", () => setMode("paint"));
  modeMoveBtn.addEventListener("click", () => setMode("move"));
  modeUVBtn.addEventListener("click", () => setMode("uv"));

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

  // === Three.js canvas texture ===
  const canvasTexture = new THREE.CanvasTexture(canvasManager.getTextureCanvas());
  canvasTexture.magFilter = THREE.NearestFilter;
  canvasTexture.minFilter = THREE.NearestFilter;

  world.createActor("camera")
    .addComponent(CameraBehavior);

  // === Three cubes at different positions with distinct rotation styles ===
  const cubePositions = [
    { x: -2.5, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 2.5, y: 0, z: 0 }
  ];

  const cubeComponents = cubePositions.map((position, i) => {
    let rotateAxes;
    if (i === 0) {
      rotateAxes = { y: true };
    }
    else if (i === 1) {
      rotateAxes = { y: true, x: true };
    }
    else {
      rotateAxes = { y: true, z: true };
    }

    return world.createActor(`cube-${i}`)
      .addComponentAndGet(CubeWithUV, {
        canvasTexture,
        position,
        speed: 0.7 + i * 0.3,
        rotateAxes
      });
  });

  const geometries = cubeComponents.map((c) => c.geometry);

  // Initial UV sync
  rebuildUVs(geometries, uvMap);

  // Keep all cube UVs in sync whenever a region is moved/resized/added/removed
  uvMap.addEventListener("changed", (e) => {
    const { type } = (e as CustomEvent<UVMapChangedDetail>).detail;
    if (type !== "select") {
      rebuildUVs(geometries, uvMap);
    }
  });

  // === UV face list panel ===
  new UVPanel({
    listEl: document.getElementById("uv-face-list") as HTMLElement,
    coordsEl: document.getElementById("uv-coords") as HTMLElement,
    uvMap
  });

  // === Resize handling ===
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
