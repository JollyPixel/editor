// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kOrigin = new THREE.Vector3();

export interface BoundedLayer {
  readonly visible: boolean;
  worldBounds(): THREE.Box3 | null;
}

export function nearestLayerBounds(
  layers: Iterable<BoundedLayer>
): THREE.Box3 | null {
  let nearest: THREE.Box3 | null = null;
  let nearestDistance = Infinity;

  for (const layer of layers) {
    if (!layer.visible) {
      continue;
    }

    const bounds = layer.worldBounds();
    if (bounds === null) {
      continue;
    }

    const distance = bounds.distanceToPoint(kOrigin);
    if (distance < nearestDistance) {
      nearest = bounds;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export function unionLayerBounds(
  layers: Iterable<BoundedLayer>
): THREE.Box3 | null {
  let union: THREE.Box3 | null = null;

  for (const layer of layers) {
    const bounds = layer.visible ? layer.worldBounds() : null;
    if (bounds !== null) {
      union = union === null ? bounds.clone() : union.union(bounds);
    }
  }

  return union;
}
