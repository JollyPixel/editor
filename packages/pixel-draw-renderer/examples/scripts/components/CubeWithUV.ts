// Import Third-party Dependencies
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import * as THREE from "three";

export interface CubeWithUVOptions {
  canvasTexture: THREE.CanvasTexture;
  /** World-space position for this cube. */
  position: { x: number; y: number; z: number; };
  /** Rotation speed multiplier (default 1). */
  speed?: number;
  /** Which axes to rotate on. */
  rotateAxes?: { x?: boolean; y?: boolean; z?: boolean; };
}

/**
 * A rotating cube whose UV attributes are updated externally.
 * Exposes `geometry` so the caller can rebuild UVs on demand.
 */
export class CubeWithUV extends ActorComponent {
  readonly geometry: THREE.BoxGeometry;
  readonly mesh: THREE.Mesh;

  #speed: number;
  #axes: { x: boolean; y: boolean; z: boolean; };
  #canvasTexture: THREE.CanvasTexture;

  constructor(
    actor: Actor,
    options: CubeWithUVOptions
  ) {
    super({ actor, typeName: "CubeWithUV" });

    this.#canvasTexture = options.canvasTexture;
    this.#speed = options.speed ?? 1;
    this.#axes = {
      x: options.rotateAxes?.x ?? false,
      y: options.rotateAxes?.y ?? true,
      z: options.rotateAxes?.z ?? false
    };

    this.geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);

    this.mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshStandardMaterial({
        map: this.#canvasTexture,
        transparent: true
      })
    );

    this.mesh.position.set(options.position.x, options.position.y, options.position.z);

    this.actor.addChildren(this.mesh);
  }

  update(): void {
    const dt = 0.008 * this.#speed;
    if (this.#axes.x) {
      this.mesh.rotation.x += dt * 0.7;
    }
    if (this.#axes.y) {
      this.mesh.rotation.y += dt;
    }
    if (this.#axes.z) {
      this.mesh.rotation.z += dt * 0.5;
    }
    this.#canvasTexture.needsUpdate = true;
  }
}
