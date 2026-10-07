// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

interface BlendedMaterial {
  transparent: boolean;
  transmission?: number;
  transmissionNode?: { isNode?: boolean; } | null;
  backdropNode?: { isNode?: boolean; } | null;
}

export class TransparentScan {
  #pending: THREE.Object3D[] = [];

  foundIn(
    root: THREE.Object3D
  ): boolean {
    const pending = this.#pending;
    pending.push(root);
    try {
      while (pending.length > 0) {
        const object = pending.pop()!;
        if (!object.visible) {
          continue;
        }
        if (drawsTransparent(object)) {
          return true;
        }
        for (const child of object.children) {
          pending.push(child);
        }
      }

      return false;
    }
    finally {
      pending.length = 0;
    }
  }
}

function drawsTransparent(
  object: THREE.Object3D
): boolean {
  const { material } = object as { material?: BlendedMaterial | BlendedMaterial[]; };
  if (material === undefined) {
    return false;
  }

  return Array.isArray(material) ?
    material.some(isTransparent) :
    isTransparent(material);
}

function isTransparent(
  material: BlendedMaterial
): boolean {
  return material.transparent === true ||
    (material.transmission ?? 0) > 0 ||
    material.transmissionNode?.isNode === true ||
    material.backdropNode?.isNode === true;
}
