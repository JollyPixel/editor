// Import Third-party Dependencies
import {
  Camera3DControls
} from "@jolly-pixel/engine";
import {
  Runtime,
  loadRuntime
} from "@jolly-pixel/runtime";
import * as THREE from "three";

// Import Internal Dependencies
import { VoxelBehavior } from "./components/VoxelMap.ts";
import {
  PANE_RUNTIME_OPTIONS,
  createExamplePane
} from "./utils/pane.ts";

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

const scene = world.sceneManager.getSource();
scene.background = new THREE.Color("#211331");

const dirLight = new THREE.DirectionalLight(new THREE.Color("#f6faff"), 2);
dirLight.position.set(20, 40, 30);
scene.add(
  new THREE.AmbientLight(new THREE.Color("#ffffff"), 2.5),
  dirLight
);

world.createActor("camera")
  .addComponent(Camera3DControls, {}, (component) => {
    component.actor.transform
      .setLocalPosition({ x: 15, y: 25, z: 42 })
      .lookAt({ x: 15, y: 0, z: 10 });
  });

world.createActor("map")
  .addComponent(VoxelBehavior);

await loadRuntime(runtime, PANE_RUNTIME_OPTIONS)
  .catch(console.error);

createExamplePane();

