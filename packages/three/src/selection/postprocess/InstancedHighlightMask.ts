// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { Fn, If, Discard, vec4 } from "three/tsl";

// Import Internal Dependencies
import { instancedVec3Attribute, instancedFloatAttribute } from "./tsl/instancedAttribute.ts";

/**
 * Per `THREE.InstancedMesh`, the GPU-side resources one mask pass needs to
 * outline individual instances rather than the mesh as a whole: per-instance
 * mask color, a per-instance "is this an entry" flag (read by `material` to
 * `Discard()` every non-entry instance's fragments, not just zero their
 * color - instancing draws every instance of the mesh in one call regardless
 * of which ones are entries, so without this discard a non-entry instance
 * would still write into the mask target's depth buffer at its own real
 * depth, letting it win the shared mask's own depth test against an
 * actually-outlined instance behind it), and a per-instance priority flag
 * (read by `priorityMaterial` to discard every non-priority instance's
 * fragments in that pass's own shader too, so a mesh with no priority
 * instances just costs one harmless all-discarded draw call rather than
 * needing a separate "does this mesh need the second pass" check).
 */
interface InstancedMaskResources {
  colorAttribute: THREE.InstancedBufferAttribute;
  maskedFlagAttribute: THREE.InstancedBufferAttribute;
  priorityFlagAttribute: THREE.InstancedBufferAttribute;
  /** Depth-tested normal-pass material - reads `colorAttribute` for every masked instance, discards the rest. */
  material: THREE.NodeMaterial;
  /** `depthTest: false` priority-pass material - discards where `priorityFlagAttribute` is `0`. */
  priorityMaterial: THREE.NodeMaterial;
}

/**
 * Owns every `InstancedMesh` instance-level entry a highlight pass (e.g.
 * `HighlightPass`, `HighlightPassJfa`) has been given via `setEntries` -
 * extracted out of the pass class itself since a mask pass's "which
 * instances are entries, what color/priority do they have" concern is
 * identical across every highlight technique (blur-based, distance-field-
 * based, or otherwise); only what happens to the resulting mask afterward
 * differs between them.
 *
 * Rather than one draw call per outlined instance, each referenced
 * `InstancedMesh` gets one dedicated set of `THREE.InstancedBufferAttribute`s
 * read via TSL's `instancedBufferAttribute()` (through
 * `tsl/instancedAttribute.ts`) - the same low-level technique three's own
 * `instance()` helper uses internally for `InstancedMesh.instanceColor`,
 * just aimed at buffers this class owns instead. Deliberately *not*
 * `mesh.instanceColor` itself - three auto-multiplies every material's
 * diffuse color by `instanceColor` when it's set (`NodeMaterial.
 * setupDiffuseColor`), which would leak into the mesh's own normal scene
 * rendering and tint every non-outlined instance pure black.
 *
 * Net cost per outlined `InstancedMesh`: two draw calls (one per mask pass)
 * regardless of how many of its instances are simultaneously outlined - same
 * shape as a whole-object entry, just per mesh instead of per outlined
 * object.
 */
export class InstancedHighlightMask {
  #entries = new Map<THREE.InstancedMesh, Map<number, { color: THREE.Color; priority: boolean; }>>();
  /**
   * Lazily-built, per-`InstancedMesh` GPU resources - a plain `Map` (not a
   * `WeakMap`) despite being keyed by scene objects, unlike similar caches
   * elsewhere - `dispose()` needs to iterate every entry to free its
   * materials, which a `WeakMap` can't be iterated to do.
   */
  #resources = new Map<THREE.InstancedMesh, InstancedMaskResources>();

  /** Number of `InstancedMesh`es with at least one recorded entry. */
  get size(): number {
    return this.#entries.size;
  }

  /** Drops every recorded entry - call before re-recording a full `setEntries` batch. */
  clear(): void {
    this.#entries.clear();
  }

  /** Records one instance of `mesh` as an entry - call `sync()` once after every entry for this batch has been added. */
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

  /**
   * Bakes every currently recorded entry into its mesh's GPU-side
   * attributes - called once per `setEntries`, not per frame.
   */
  sync(): void {
    for (const [mesh, idColor] of this.#entries) {
      const resources = this.#resourcesFor(mesh);
      resources.colorAttribute.array.fill(0);
      resources.maskedFlagAttribute.array.fill(0);
      resources.priorityFlagAttribute.array.fill(0);

      for (const [instanceId, { color, priority }] of idColor) {
        color.toArray(resources.colorAttribute.array, instanceId * 3);
        resources.maskedFlagAttribute.array[instanceId] = 1;
        resources.priorityFlagAttribute.array[instanceId] = priority ? 1 : 0;
      }

      resources.colorAttribute.needsUpdate = true;
      resources.maskedFlagAttribute.needsUpdate = true;
      resources.priorityFlagAttribute.needsUpdate = true;
    }
  }

  /**
   * This mesh's mask materials, if it has at least one recorded entry -
   * lazily builds/caches its GPU resources on first use. `undefined` for a
   * mesh with none, collapsing the caller's "has an entry? then get
   * resources" into one lookup.
   */
  materialsFor(
    mesh: THREE.InstancedMesh
  ): Pick<InstancedMaskResources, "material" | "priorityMaterial"> | undefined {
    if (!this.#entries.has(mesh)) {
      return undefined;
    }

    return this.#resourcesFor(mesh);
  }

  /**
   * Lazily builds (and rebuilds if `mesh.count` has since changed) the GPU
   * resources one `InstancedMesh` needs to mask its own instances - reused
   * and just rewritten across `sync()` calls, so outlining a different
   * subset of the same mesh's instances never costs a new shader compile.
   */
  #resourcesFor(
    mesh: THREE.InstancedMesh
  ): InstancedMaskResources {
    const cached = this.#resources.get(mesh);
    if (cached && cached.colorAttribute.count === mesh.count) {
      return cached;
    }
    cached?.material.dispose();
    cached?.priorityMaterial.dispose();

    const colorAttribute = new THREE.InstancedBufferAttribute(new Float32Array(mesh.count * 3), 3);
    const maskedFlagAttribute = new THREE.InstancedBufferAttribute(new Float32Array(mesh.count), 1);
    const priorityFlagAttribute = new THREE.InstancedBufferAttribute(new Float32Array(mesh.count), 1);

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
      colorAttribute, maskedFlagAttribute, priorityFlagAttribute, material, priorityMaterial
    };
    this.#resources.set(mesh, resources);

    return resources;
  }

  /** Frees every cached material and drops every recorded entry. */
  dispose(): void {
    this.#entries.clear();
    for (const resources of this.#resources.values()) {
      resources.material.dispose();
      resources.priorityMaterial.dispose();
    }
    this.#resources.clear();
  }
}
