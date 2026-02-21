// Import Third-party Dependencies
import { Camera3DControls } from "@jolly-pixel/engine";
import {
  Runtime,
  loadRuntime
} from "@jolly-pixel/runtime";
import * as THREE from "three";

// Import Internal Dependencies
import {
  VoxelRenderer
} from "../../src/index.ts";
import { VoxelBehavior } from "./components/VoxelMap.ts";
import { createExamplesMenu } from "./utils/menu.ts";

const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("HTMLCanvasElement not found");
}

const runtime = new Runtime(canvas, {
  includePerformanceStats: true
});

const { world } = runtime;
world.logger.setLevel("debug");
world.logger.enableNamespace("*");

// ── Scene ─────────────────────────────────────────────────────────────────────
const scene = world.sceneManager.getSource();
scene.background = new THREE.Color("#211331");

const dirLight = new THREE.DirectionalLight(new THREE.Color("#f6faff"), 2);
dirLight.position.set(20, 40, 30);
scene.add(
  new THREE.AmbientLight(new THREE.Color("#ffffff"), 2.5),
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
world.createActor("map")
  .addComponent(VoxelRenderer, {
    material: "lambert",
    materialCustomizer: (material) => {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.metalness = 0;
        material.roughness = 0.85;
      }
    }
  })
  .addComponent(VoxelBehavior);

// ── Load runtime ────────────────────────────────────────────
await loadRuntime(runtime)
  .catch(console.error);

createExamplesMenu();

