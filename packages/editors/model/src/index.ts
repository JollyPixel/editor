// Import Third-party Dependencies
import {
  Actor,
  Camera3DControls,
  ModelRenderer
} from "@jolly-pixel/engine";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import * as THREE from "three";

// Import Internal Dependencies
import { PlayerBehavior } from "./PlayerBehavior.ts";

const runtime = initRuntime();
loadRuntime(runtime)
  .catch(console.error);

function initRuntime() {
  const canvasHTMLElement = document.querySelector("canvas") as HTMLCanvasElement;
  const runtime = new Runtime(canvasHTMLElement, {
    includePerformanceStats: true
  });
  const { world } = runtime;

  const { camera } = new Actor(world, { name: "camera" })
    .addComponentAndGet(
      Camera3DControls,
      { speed: 0.25, rotationSpeed: 0.50 }
    );

  camera.position.set(5, 5, 5);
  camera.lookAt(0, 0, 0);

  new Actor(world, { name: "tinyWitchModel" })
    .addComponent(ModelRenderer, {
      path: "models/Tiny_Witch.obj"
    }, (component) => {
      component.actor.object3D.position.set(-5, 0, 0);
    });
  // new Actor(world, { name: "tree" })
  //   .addComponent(ModelRenderer, {
  //     path: "models/CommonTree_1.obj"
  //   }, (component) => {
  //     component.actor.object3D.position.set(0, 0, 0);
  //   });
  new Actor(world, { name: "player" })
    .addComponent(ModelRenderer, {
      path: "models/Standard.fbx"
    })
    .addComponent(PlayerBehavior, {}, (_component) => {
      // console.log(component);
      // component.onPlayerPunch.connect(() => {
      //   console.log("Player punched!");
      // });
    });
  // new Actor(world, { name: "duckModel" })
  //   .addComponent(ModelRenderer, {
  //     path: "models/Duck.gltf"
  //   }, (component) => {
  //     component.actor.object3D.position.set(-2, 0, 0);
  //     component.actor.object3D.rotateY(45);
  //   });
  // new Actor(world, { name: "toyCarModel" })
  //   .addComponent(ModelRenderer, {
  //     path: "models/ToyCar.glb"
  //   }, (component) => {
  //     component.actor.object3D.position.set(0, 0.90, -4);
  //     component.actor.object3D.scale.set(50, 50, 50);
  //   });

  const scene = world.sceneManager.getSource();
  scene.background = null;
  scene.add(
    new THREE.GridHelper(
      10,
      10,
      new THREE.Color("#888888")
    ),
    new THREE.AmbientLight(new THREE.Color("#ffffff"), 1)
  );

  return runtime;
}
