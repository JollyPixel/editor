// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// CONSTANTS
const kDefaultColor = "#4a90d9";
const kEmptyLabel = "-";

export interface Selectable {
  id: string;
  label: string;
  object: THREE.Object3D;
}

export class Selectables {
  readonly items: Selectable[] = [];

  #labels = new Map<string, string>();
  #pickable: THREE.Object3D[] = [];
  #ids = new Map<THREE.Object3D, string>();

  add(
    selectable: Selectable,
    pickable = true
  ): THREE.Object3D {
    const { id, label, object } = selectable;

    this.items.push(selectable);
    this.#labels.set(id, label);
    if (pickable) {
      this.#pickable.push(object);
      this.#ids.set(object, id);
    }

    return object;
  }

  labelOf(
    id: string | null
  ): string {
    return id === null ? kEmptyLabel : this.#labels.get(id) ?? id;
  }

  pick(
    raycaster: THREE.Raycaster
  ): string | null {
    const [hit] = raycaster.intersectObjects(this.#pickable, false);

    return hit === undefined ? null : this.#ids.get(hit.object) ?? null;
  }
}

export function selectionMaterial(
  color: THREE.ColorRepresentation = kDefaultColor
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color });
}

export function hexOf(
  color: THREE.ColorRepresentation
): string {
  return `#${new THREE.Color(color).getHexString()}`;
}

export function addSelectionLighting(
  scene: THREE.Scene
): void {
  scene.add(new THREE.AmbientLight("#ffffff", 0.7));

  const keyLight = new THREE.DirectionalLight("#ffffff", 0.8);
  keyLight.position.set(4, 6, 3);
  scene.add(keyLight);
}
