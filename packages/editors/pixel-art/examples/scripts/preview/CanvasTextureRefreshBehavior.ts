// Import Third-party Dependencies
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import type * as THREE from "three";

export interface CanvasTextureRefreshBehaviorOptions {
  canvasTexture: THREE.CanvasTexture;
}

/** Keeps the shared preview texture synced with local and remote edits. */
export class CanvasTextureRefreshBehavior extends ActorComponent {
  readonly #canvasTexture: THREE.CanvasTexture;

  constructor(
    actor: Actor,
    options: CanvasTextureRefreshBehaviorOptions
  ) {
    super({
      actor,
      typeName: "CanvasTextureRefreshBehavior"
    });
    this.#canvasTexture = options.canvasTexture;
  }

  update(
    _deltaTime: number
  ): void {
    this.#canvasTexture.needsUpdate = true;
  }
}
