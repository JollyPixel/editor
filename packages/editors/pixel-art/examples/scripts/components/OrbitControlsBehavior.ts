// Import Third-party Dependencies
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface OrbitControlsBehaviorOptions {
  camera: THREE.Camera;
  /** @default (0, 0, 0) */
  target?: THREE.Vector3;
  /** @default 3 */
  minDistance?: number;
  /** @default 30 */
  maxDistance?: number;
}

/**
 * Damped drag-to-orbit / scroll-to-zoom camera control, so every face of
 * the test cubes can actually be inspected (the camera used to be static).
 * A short, no-movement click still reaches the canvas as a native "click"
 * event afterwards, so cube picking (see main.ts) keeps working alongside
 * a drag-to-rotate gesture.
 */
export class OrbitControlsBehavior extends ActorComponent {
  readonly controls: OrbitControls;

  constructor(
    actor: Actor,
    options: OrbitControlsBehaviorOptions
  ) {
    super({
      actor,
      typeName: "OrbitControlsBehavior"
    });

    this.controls = new OrbitControls(
      options.camera,
      actor.world.renderer.canvas
    );
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = options.minDistance ?? 3;
    this.controls.maxDistance = options.maxDistance ?? 30;
    if (options.target) {
      this.controls.target.copy(options.target);
    }
    this.controls.update();
  }

  update(): void {
    this.controls.update();
  }

  override destroy(): void {
    this.controls.dispose();
    super.destroy();
  }
}
