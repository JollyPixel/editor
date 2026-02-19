// Import Third-party Dependencies
import { Camera3DControls } from "@jolly-pixel/engine";
import {
  Runtime,
  loadRuntime
} from "@jolly-pixel/runtime";
import * as THREE from "three";

// Import Internal Dependencies
import {
  VoxelRenderer,
  TiledConverter,
  type TiledMap
} from "../../src/index.ts";
import { createExamplesMenu } from "./utils/menu.ts";

const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("HTMLCanvasElement not found");
}

const runtime = new Runtime(canvas, {
  includePerformanceStats: true
});

const { world } = runtime;

// ── Scene ─────────────────────────────────────────────────────────────────────
const scene = world.sceneManager.getSource();
scene.background = new THREE.Color("#87ceeb");

const dirLight = new THREE.DirectionalLight(new THREE.Color("#ffffff"), 1.5);
dirLight.position.set(20, 40, 30);
scene.add(
  new THREE.AmbientLight(new THREE.Color("#ffffff"), 1.5),
  dirLight
);

// ── Camera ────────────────────────────────────────────────────────────────────
// Map is 30 × 20 tiles at Y = 0. Position camera above and behind the centre
// so the full terrain is visible on load. Use WASD + mouse to navigate.
world.createActor("camera")
  .addComponent(Camera3DControls, { speed: 0.35, rotationSpeed: 0.5 }, (component) => {
    component.camera.position.set(15, 25, 42);
    component.camera.lookAt(15, 0, 10);
  });

// ── VoxelRenderer ─────────────────────────────────────────────────────────────
// No blocks or layers supplied here — load() will register them from the JSON.
const voxelMap = world.createActor("map")
  .addComponentAndGet(VoxelRenderer, {
    alphaTest: 0.1,
    material: "lambert"
  });

// ── Load and convert the Tiled map ────────────────────────────────────────────
async function main(): Promise<void> {
  const tiledMap = await fetch("tilemap/experimental_map.tmj")
    .then((r) => r.json()) as TiledMap;

  const worldJson = new TiledConverter().convert(tiledMap, {
    // Map Tiled .tsx source references to the matching .png files served from
    // public/tilemap/ (spaces in filenames are intentional — Vite handles them).
    resolveTilesetSrc: (tiledSource) => "tilemap/" + tiledSource.replace(/\.tsx$/, ".png"),
    layerMode: "stacked"
  });

  // Kick off tileset loading + world deserialization concurrently with the
  // runtime splash (~850 ms delay) so textures are ready before awake() runs.
  voxelMap.load(worldJson).catch(console.error);
  await loadRuntime(runtime);
}

createExamplesMenu();
main().catch(console.error);
