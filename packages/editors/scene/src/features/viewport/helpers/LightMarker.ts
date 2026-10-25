// Import Third-party Dependencies
import * as THREE from "three";
import type { LightComponent } from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  HELPER_COLOR,
  HELPER_MATERIAL,
  type ComponentHelper
} from "./ComponentHelper.ts";

// CONSTANTS
const kLightIcon = new THREE.OctahedronGeometry(0.18);

type LightHelperObject =
  | THREE.DirectionalLightHelper
  | THREE.SpotLightHelper
  | THREE.HemisphereLightHelper
  | THREE.PointLightHelper;

export class LightMarker implements ComponentHelper {
  readonly root = new THREE.Group();

  #component: LightComponent;
  #icon = new THREE.Mesh(kLightIcon, HELPER_MATERIAL);
  #light: THREE.Light | null = null;
  #shape: LightHelperObject | null = null;

  constructor(
    component: LightComponent
  ) {
    this.#component = component;
    this.root.add(this.#icon);
  }

  sync(): void {
    const light = this.#component.threeLight;
    if (light !== this.#light) {
      this.#disposeShape();
      this.#light = light;
      this.#shape = createLightShape(light);
      if (this.#shape !== null) {
        this.root.add(this.#shape);
      }
    }

    this.#component.actor.object3D.getWorldPosition(this.#icon.position);
    light.updateWorldMatrix(true, true);
    this.#shape?.update();
  }

  dispose(): void {
    this.#disposeShape();
  }

  #disposeShape(): void {
    if (this.#shape !== null) {
      this.root.remove(this.#shape);
      this.#shape.dispose();
      this.#shape = null;
    }
  }
}

function createLightShape(
  light: THREE.Light
): LightHelperObject | null {
  if (light instanceof THREE.DirectionalLight) {
    return new THREE.DirectionalLightHelper(light, 0.6, HELPER_COLOR);
  }
  if (light instanceof THREE.SpotLight) {
    return new THREE.SpotLightHelper(light, HELPER_COLOR);
  }
  if (light instanceof THREE.HemisphereLight) {
    return new THREE.HemisphereLightHelper(light, 0.4, HELPER_COLOR);
  }
  if (light instanceof THREE.PointLight) {
    return new THREE.PointLightHelper(light, 0.25, HELPER_COLOR);
  }

  return null;
}
