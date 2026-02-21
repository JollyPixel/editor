// Import Third-party Dependencies
import {
  Camera3DControls,
  ModelRenderer
} from "@jolly-pixel/engine";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import * as THREE from "three";

// Import Internal Dependencies
import { PlayerBehavior } from "./components/PlayerBehavior.ts";

const runtime = initRuntime();
loadRuntime(runtime)
  .catch(console.error);

function initRuntime() {
  const canvasHTMLElement = document.querySelector("canvas") as HTMLCanvasElement;
  const runtime = new Runtime(canvasHTMLElement, {
    includePerformanceStats: true
  });
  const { world } = runtime;

  const { camera } = world.createActor("camera")
    .addComponentAndGet(
      Camera3DControls,
      { speed: 0.25, rotationSpeed: 0.50 }
    );
  camera.position.set(5, 5, 5);
  camera.lookAt(0, 0, 0);

  world.createActor("tinyWitchModel")
    .addComponent(ModelRenderer, {
      path: "models/Tiny_Witch.obj"
    }, (component) => {
      component.actor.object3D.position.set(-5, 0, 0);
    });

  world.createActor("player")
    .addComponent(ModelRenderer, {
      path: "models/Standard.fbx"
    })
    .addComponent(PlayerBehavior);

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
