// Import Third-party Dependencies
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import * as THREE from "three";
import { ViewHelper } from "three/addons/helpers/ViewHelper.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class OrbitCameraControls extends ActorComponent {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  helper: ViewHelper;

  constructor(actor: Actor) {
    super({ actor, typeName: "Camera" });

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    this.controls = new OrbitControls(this.camera, this.actor.gameInstance.threeRenderer.domElement);
    this.camera.position.set(0, 20, 100);
    this.camera.lookAt(0, 0, 0);

    this.helper = new ViewHelper(
      this.camera,
      this.actor.gameInstance.threeRenderer.domElement
    );
    this.actor.gameInstance.on("draw", () => {
      this.helper.render(this.actor.gameInstance.threeRenderer);
    });
  }

  start() {
    this.actor.gameInstance.renderComponents.push(this.camera);
  }

  update() {
    this.controls.update();
  }
}
