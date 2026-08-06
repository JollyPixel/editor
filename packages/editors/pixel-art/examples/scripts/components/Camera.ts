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

    this.actor.transform.setLocalPosition({ x: 0, y: 0, z: 8 });
  }

  get camera(): THREE.PerspectiveCamera {
    return this.threeCamera as THREE.PerspectiveCamera;
  }
}
