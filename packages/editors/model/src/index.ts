// Import Third-party Dependencies
import {
  Actor,
  Components,
  ModelRenderer
} from "@jolly-pixel/engine";
import { Player, loadPlayer } from "@jolly-pixel/runtime";
import * as THREE from "three";

// Import Internal Dependencies
import { PlayerBehavior } from "./PlayerBehavior.js";
import { ModelManipulator } from "./ModelManipulator.js";

const runtime = initRuntime();
loadPlayer(runtime)
  .catch(console.error);

function initRuntime() {
  const canvasHTMLElement = document.querySelector("canvas") as HTMLCanvasElement;
  const runtime = new Player(canvasHTMLElement, {
    includePerformanceStats: true
  });
  const { gameInstance } = runtime;
  // gameInstance.setRatio(16 / 9);

  const { camera } = new Actor(gameInstance, { name: "camera" })
    .registerComponentAndGet(
      Components.Camera3DControls,
      { speed: 0.25, rotationSpeed: 0.50 }
    );

  camera.position.set(5, 5, 5);
  camera.lookAt(0, 0, 0);

  new Actor(gameInstance, { name: "modelManipulator" })
    .registerComponent(ModelManipulator, {
      camera
    });

  new Actor(gameInstance, { name: "tinyWitchModel" })
    .registerComponent(ModelRenderer, {
      path: "models/Tiny_Witch.obj"
    }, (component) => {
      component.actor.threeObject.position.set(-5, 0, 0);
    });
  // new Actor(gameInstance, { name: "tree" })
  //   .registerComponent(ModelRenderer, {
  //     path: "models/CommonTree_1.obj"
  //   }, (component) => {
  //     component.actor.threeObject.position.set(0, 0, 0);
  //   });
  new Actor(gameInstance, { name: "player" })
    .registerComponent(PlayerBehavior);
  // new Actor(gameInstance, { name: "duckModel" })
  //   .registerComponent(ModelRenderer, {
  //     path: "models/Duck.gltf"
  //   }, (component) => {
  //     component.actor.threeObject.position.set(-2, 0, 0);
  //     component.actor.threeObject.rotateY(45);
  //   });
  // new Actor(gameInstance, { name: "toyCarModel" })
  //   .registerComponent(ModelRenderer, {
  //     path: "models/ToyCar.glb"
  //   }, (component) => {
  //     component.actor.threeObject.position.set(0, 0.90, -4);
  //     component.actor.threeObject.scale.set(50, 50, 50);
  //   });

  gameInstance.threeScene.background = null;
  gameInstance.threeScene.add(
    new THREE.GridHelper(
      10,
      10,
      new THREE.Color("#888888")
    ),
    new THREE.AmbientLight(new THREE.Color("#ffffff"), 1)
  );

  return runtime;
}
