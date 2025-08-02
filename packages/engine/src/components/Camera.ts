// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { Actor } from "../Actor.js";
import { ActorComponent } from "../ActorComponent.js";

export interface CameraOptions {
  fov?: number;
  aspect?: number;
  near?: number;
  far?: number;
}

export class Camera extends ActorComponent {
  threeCamera: THREE.PerspectiveCamera;

  constructor(
    actor: Actor,
    options: CameraOptions = {}
  ) {
    super({
      actor,
      typeName: "Camera"
    });

    const {
      fov = 45,
      aspect = window.innerWidth / window.innerHeight,
      near = 1,
      far = 10000
    } = options;

    this.threeCamera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  }

  start() {
    this.threeCamera.add(this.actor.gameInstance.audio);
    this.actor.gameInstance.renderComponents.push(this.threeCamera);
  }

  override destroy() {
    const index = this.actor.gameInstance.renderComponents.indexOf(this.threeCamera);
    if (index !== -1) {
      this.actor.gameInstance.renderComponents.splice(index, 1);
    }
    super.destroy();
  }
}
