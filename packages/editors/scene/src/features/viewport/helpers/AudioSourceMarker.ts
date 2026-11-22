// Import Third-party Dependencies
import type { AudioSourceComponent } from "@jolly-pixel/backend.three";
import { AudioGizmo } from "@jolly-pixel/three";

// Import Internal Dependencies
import type { ComponentHelper } from "./ComponentHelper.ts";

export class AudioSourceMarker implements ComponentHelper {
  readonly root = new AudioGizmo();

  #component: AudioSourceComponent;

  constructor(
    component: AudioSourceComponent
  ) {
    this.#component = component;
  }

  sync(): void {
    const component = this.#component;
    this.root.update(
      component.actor.transform.global.position,
      component.settings.color
    );
  }

  dispose(): void {
    this.root.dispose();
  }
}
