// Import Third-party Dependencies
import type { LightComponent } from "@jolly-pixel/engine";
import { LightGizmo } from "@jolly-pixel/three";

// Import Internal Dependencies
import type { ComponentHelper } from "./ComponentHelper.ts";

export class LightMarker implements ComponentHelper {
  readonly root = new LightGizmo();

  #component: LightComponent;

  constructor(
    component: LightComponent
  ) {
    this.#component = component;
  }

  sync(): void {
    const component = this.#component;
    this.root.update(component.threeLight);
    this.root.position.copy(component.actor.transform.global.position);
  }

  dispose(): void {
    this.root.dispose();
  }
}
