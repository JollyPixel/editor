// Import Third-party Dependencies
import {
  Actor,
  ActorComponent,
  createViewHelper
} from "@jolly-pixel/engine";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class OrbitCameraControls extends ActorComponent {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;

  constructor(actor: Actor) {
    super({ actor, typeName: "Camera" });

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    this.controls = new OrbitControls(this.camera, this.actor.gameInstance.canvas);
    this.camera.position.set(0, 20, 100);
    this.camera.lookAt(0, 0, 0);

    createViewHelper(this.camera, this.actor.gameInstance);
  }

  start() {
    this.actor.gameInstance.renderer.addRenderComponent(this.camera);
  }

  update() {
    this.controls.update();
  }
}
