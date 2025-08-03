// Import Third-party Dependencies
import {
  Systems,
  Actor,
  Components
} from "@jolly-pixel/engine";
import * as THREE from "three";

// Import Internal Dependencies
import { SpriteRenderer } from "./components/SpriteRenderer.class.js";

const canvasHTMLElement = document.querySelector("canvas") as HTMLCanvasElement;
const runtime = new Systems.Runtime(canvasHTMLElement, {
  includePerformanceStats: true
});
const { gameInstance } = runtime;

new Actor(gameInstance, { name: "camera" })
  .registerComponent(Components.Camera3DControls, { speed: 0.35, rotationSpeed: 0.45 }, (component) => {
    component.camera.position.set(10, 10, 5);
    component.camera.lookAt(0, 0, 0);
  });

new Actor(gameInstance, { name: "sprite" })
  .registerComponent(SpriteRenderer, {
    texture: "./assets/sprites/dino.png",
    tileHorizontal: 24,
    tileVertical: 1,
    animations: {
      idle: { from: 0, to: 13 }
    }
  }, (sprite) => {
    sprite.animation.play("idle", { loop: true, duration: 0.5 });
  });

gameInstance.threeScene.background = null;
gameInstance.threeScene.add(
  // new THREE.GridHelper(
  //   50,
  //   10,
  //   new THREE.Color("#888888")
  // ),
  new THREE.AmbientLight(new THREE.Color("#ffffff"), 1)
);

runtime.start();
