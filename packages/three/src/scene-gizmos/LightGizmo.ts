// Import Third-party Dependencies
import * as THREE from "three";

export interface LightGizmoOptions {
  /**
   * @default "#f5c46b"
   */
  color?: THREE.ColorRepresentation;
}

type LightShape =
  | THREE.DirectionalLightHelper
  | THREE.SpotLightHelper
  | THREE.HemisphereLightHelper
  | THREE.PointLightHelper;

// CONSTANTS
const kDefaultColor = "#f5c46b";

export class LightGizmo extends THREE.Group {
  readonly #color: THREE.ColorRepresentation;
  readonly #icon: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  #light: THREE.Light | null = null;
  #shape: LightShape | null = null;

  constructor(
    options: LightGizmoOptions = {}
  ) {
    super();
    const { color = kDefaultColor } = options;

    this.#color = color;
    this.#icon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18),
      new THREE.MeshBasicMaterial({
        color,
        wireframe: true
      })
    );
    this.add(this.#icon);
  }

  update(
    light: THREE.Light
  ): void {
    if (light !== this.#light) {
      this.#disposeShape();
      this.#light = light;
      this.#shape = createLightShape(light, this.#color);
      if (this.#shape !== null) {
        this.add(this.#shape);
      }
    }

    light.updateWorldMatrix(true, true);
    light.getWorldPosition(this.#icon.position);
    this.#shape?.update();
  }

  override dispose(): void {
    this.#disposeShape();
    this.#icon.geometry.dispose();
    this.#icon.material.dispose();
  }

  #disposeShape(): void {
    if (this.#shape !== null) {
      this.remove(this.#shape);
      this.#shape.dispose();
      this.#shape = null;
    }
  }
}

function createLightShape(
  light: THREE.Light,
  color: THREE.ColorRepresentation
): LightShape | null {
  if (light instanceof THREE.DirectionalLight) {
    return new THREE.DirectionalLightHelper(light, 0.6, color);
  }
  if (light instanceof THREE.SpotLight) {
    return new THREE.SpotLightHelper(light, color);
  }
  if (light instanceof THREE.HemisphereLight) {
    return new THREE.HemisphereLightHelper(light, 0.4, color);
  }
  if (light instanceof THREE.PointLight) {
    return new THREE.PointLightHelper(light, 0.25, color);
  }

  return null;
}
