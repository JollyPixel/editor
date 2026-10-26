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
    this.root.update(this.#component.threeLight);
  }

  dispose(): void {
    this.root.dispose();
  }
}
