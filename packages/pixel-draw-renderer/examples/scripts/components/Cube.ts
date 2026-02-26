// Import Third-party Dependencies
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import * as THREE from "three";

export interface CubeBehaviorOptions {
  canvasTexture: THREE.CanvasTexture;
}

export class CubeBehavior extends ActorComponent {
  mesh: THREE.Mesh;
  canvasTexture: THREE.CanvasTexture;

  constructor(
    actor: Actor,
    options: CubeBehaviorOptions
  ) {
    super({
      actor,
      typeName: "CubeBehavior"
    });

    const { canvasTexture } = options;

    this.canvasTexture = canvasTexture;
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.5, 1.5),
      new THREE.MeshStandardMaterial({
        map: canvasTexture,
        transparent: true
      })
    );
    this.actor.addChildren(this.mesh);
  }

  update() {
    this.mesh.rotation.x += 0.005;
    this.mesh.rotation.y += 0.01;
    this.canvasTexture.needsUpdate = true;
  }
}
