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
    this.threeCamera.add(this.actor.gameInstance.audio.listener);
    this.actor.gameInstance.renderer.addRenderComponent(this.threeCamera);
  }

  override destroy() {
    this.actor.gameInstance.renderer.removeRenderComponent(this.threeCamera);
    super.destroy();
  }
}
