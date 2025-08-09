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
    .registerComponent(Components.Camera3DControls, { speed: 0.25, rotationSpeed: 0.50 }, (component) => {
      component.camera.position.set(5, 5, 5);
      component.camera.lookAt(0, 0, 0);
    });
  new Actor(gameInstance, { name: "tinyWitchModel" })
    .registerComponent(ModelRenderer, {
      path: "models/Tiny_Witch.obj"
    });
  new Actor(gameInstance, { name: "treeModel" })
    .registerComponent(ModelRenderer, {
      path: "models/Tree.fbx"
    }, (component) => {
      component.actor.threeObject.position.set(2, 0, 0);
    });
  new Actor(gameInstance, { name: "duckModel" })
    .registerComponent(ModelRenderer, {
      path: "models/Duck.gltf"
    }, (component) => {
      component.actor.threeObject.position.set(-2, 0, 0);
      component.actor.threeObject.rotateY(45);
    });
  new Actor(gameInstance, { name: "toyCarModel" })
    .registerComponent(ModelRenderer, {
      path: "models/ToyCar.glb"
    }, (component) => {
      component.actor.threeObject.position.set(0, 0.90, -4);
      component.actor.threeObject.scale.set(50, 50, 50);
    });

  gameInstance.threeScene.background = null;
  gameInstance.threeScene.add(
    new THREE.GridHelper(
      10,
      10,
      new THREE.Color("#888888")
    ),
    new THREE.AmbientLight(new THREE.Color("#ffffff"), 2)
  );

  return runtime;
}
