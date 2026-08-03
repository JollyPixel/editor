// Import Third-party Dependencies
import {
  type Actor,
  CameraComponent
} from "@jolly-pixel/engine";
import * as THREE from "three";

export class CameraBehavior extends CameraComponent {
  constructor(
    actor: Actor
  ) {
    super(actor, {
      projectionMode: "perspective",
      fov: 45,
      near: 0.1,
      far: 100
    });

    this.threeCamera.position.set(0, 0, 8);
  }

  get camera(): THREE.PerspectiveCamera {
    return this.threeCamera as THREE.PerspectiveCamera;
  }
}
