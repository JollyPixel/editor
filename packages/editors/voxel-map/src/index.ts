// Import Third-party Dependencies
import {
  Systems,
  Actor,
  Components
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import { VoxelRenderer } from "./VoxelRenderer.js";

const canvasHTMLElement = document.getElementById("game") as HTMLCanvasElement;
const runtime = new Systems.Runtime(canvasHTMLElement, {
  includePerformanceStats: true
});
const { gameInstance } = runtime;

new Actor(gameInstance, { name: "camera" })
  .registerComponent(Components.Camera3DControls, { speed: 8, rotationSpeed: 1 });

new Actor(gameInstance, { name: "map" })
  .registerComponent(VoxelRenderer, { ratio: 32, cameraActorName: "camera" });

runtime.start();
