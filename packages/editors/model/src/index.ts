// Import Third-party Dependencies
import {
  Systems,
  Actor,
  Components
} from "@jolly-pixel/engine";
import * as THREE from "three";

// Import Internal Dependencies
import { ModelRenderer } from "./ModelRenderer.js";

const runtime = initRuntime();
runtime.start();

function initRuntime() {
  const canvasHTMLElement = document.querySelector("canvas") as HTMLCanvasElement;
  const runtime = new Systems.Runtime(canvasHTMLElement, {
    includePerformanceStats: true
  });
  const { gameInstance } = runtime;
  // gameInstance.setRatio(16 / 9);

  new Actor(gameInstance, { name: "camera" })
    .registerComponent(Components.Camera3DControls, { speed: 8, rotationSpeed: 1 }, (component) => {
      component.camera.position.set(200, 200, 400);
      component.camera.lookAt(0, 0, 0);
    });
  new Actor(gameInstance, { name: "model" })
    .registerComponent<any>(ModelRenderer, {});

  gameInstance.threeScene.background = null;
  gameInstance.threeScene.add(
    new THREE.GridHelper(
      1000,
      32,
      new THREE.Color("#888888")
    ),
    new THREE.AmbientLight(new THREE.Color("#ffffff"), 30)
  );

  return runtime;
}
