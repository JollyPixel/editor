// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Fn, If, Discard, vec4 } from "three/tsl";

// Import Internal Dependencies
import {
  instancedVec3Attribute,
  instancedFloatAttribute
} from "./tsl/instancedAttribute.ts";

interface InstancedMaskResources {
  colorAttribute: THREE.InstancedBufferAttribute;
  maskedFlagAttribute: THREE.InstancedBufferAttribute;
  priorityFlagAttribute: THREE.InstancedBufferAttribute;
  material: THREE.NodeMaterial;
  priorityMaterial: THREE.NodeMaterial;
}

export class InstancedHighlightMask {
  #entries = new Map<
    THREE.InstancedMesh,
    Map<number, { color: THREE.Color; priority: boolean; }>
  >();
  #resources = new Map<THREE.InstancedMesh, InstancedMaskResources>();

  get size(): number {
    return this.#entries.size;
  }

  clear(): void {
    this.#entries.clear();
  }

  add(
    mesh: THREE.InstancedMesh,
    instanceId: number,
    color: THREE.Color,
    priority: boolean
  ): void {
    let idColor = this.#entries.get(mesh);
    if (!idColor) {
      idColor = new Map();
      this.#entries.set(mesh, idColor);
    }
    idColor.set(instanceId, { color, priority });
  }

  sync(): void {
    for (const [mesh, idColor] of this.#entries) {
      const resources = this.#resourcesFor(mesh);
      resources.colorAttribute.array.fill(0);
      resources.maskedFlagAttribute.array.fill(0);
      resources.priorityFlagAttribute.array.fill(0);

      for (const [instanceId, { color, priority }] of idColor) {
        color.toArray(
          resources.colorAttribute.array,
          instanceId * 3
        );
        resources.maskedFlagAttribute.array[instanceId] = 1;
        resources.priorityFlagAttribute.array[instanceId] = priority ? 1 : 0;
      }

      resources.colorAttribute.needsUpdate = true;
      resources.maskedFlagAttribute.needsUpdate = true;
      resources.priorityFlagAttribute.needsUpdate = true;
    }
  }

  materialsFor(
    mesh: THREE.InstancedMesh
  ): Pick<InstancedMaskResources, "material" | "priorityMaterial"> | undefined {
    if (!this.#entries.has(mesh)) {
      return undefined;
    }

    return this.#resourcesFor(mesh);
  }

  #resourcesFor(
    mesh: THREE.InstancedMesh
  ): InstancedMaskResources {
    const cached = this.#resources.get(mesh);
    if (
      cached &&
      cached.colorAttribute.count === mesh.count
    ) {
      return cached;
    }

    cached?.material.dispose();
    cached?.priorityMaterial.dispose();

    const colorAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(mesh.count * 3),
      3
    );
    const maskedFlagAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(mesh.count),
      1
    );
    const priorityFlagAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(mesh.count),
      1
    );

    const material = new THREE.NodeMaterial();
    material.name = "InstancedHighlightMask.material";
    material.colorNode = Fn(() => {
      If(instancedFloatAttribute(maskedFlagAttribute).lessThan(0.5), () => {
        Discard();
      });

      return vec4(instancedVec3Attribute(colorAttribute), 1);
    })();

    const priorityMaterial = new THREE.NodeMaterial();
    priorityMaterial.name = "InstancedHighlightMask.priorityMaterial";
    priorityMaterial.depthTest = false;
    priorityMaterial.colorNode = Fn(() => {
      If(instancedFloatAttribute(priorityFlagAttribute).lessThan(0.5), () => {
        Discard();
      });

      return vec4(instancedVec3Attribute(colorAttribute), 1);
    })();

    const resources: InstancedMaskResources = {
      colorAttribute,
      maskedFlagAttribute,
      priorityFlagAttribute,
      material,
      priorityMaterial
    };
    this.#resources.set(mesh, resources);

    return resources;
  }

  dispose(): void {
    this.#entries.clear();
    for (const resources of this.#resources.values()) {
      resources.material.dispose();
      resources.priorityMaterial.dispose();
    }
    this.#resources.clear();
  }
}
