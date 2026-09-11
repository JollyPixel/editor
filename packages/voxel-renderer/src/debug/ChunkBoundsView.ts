// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  ChunkDebugView,
  DebugChunkEntry
} from "./types.ts";

// CONSTANTS
const kDefaultColor = 0xFF3B30;
// Drawn after the world so the depth-test-free lines land on top.
const kRenderOrder = 999;
/*
 * Twelve edges of the unit cube spanning [0,1] on every axis, so a chunk box
 * is placed with `position = world origin` and `scale = chunk size`.
 */
const kBoxEdgePositions = new Float32Array([
  0, 0, 0, 1, 0, 0,
  1, 0, 0, 1, 0, 1,
  1, 0, 1, 0, 0, 1,
  0, 0, 1, 0, 0, 0,
  0, 1, 0, 1, 1, 0,
  1, 1, 0, 1, 1, 1,
  1, 1, 1, 0, 1, 1,
  0, 1, 1, 0, 1, 0,
  0, 0, 0, 0, 1, 0,
  1, 0, 0, 1, 1, 0,
  1, 0, 1, 1, 1, 1,
  0, 0, 1, 0, 1, 1
]);

export interface ChunkBoundsViewOptions {
  parent: THREE.Object3D;
  chunks: Iterable<DebugChunkEntry>;
  /**
   * @default false
   */
  enabled?: boolean;
  /**
   * @default 0xFF3B30
   */
  color?: THREE.ColorRepresentation;
}

/**
 * Outlines the boundary of every registered chunk.
 */
export class ChunkBoundsView implements ChunkDebugView {
  #parent: THREE.Object3D;
  #chunks: Iterable<DebugChunkEntry>;
  #group = new THREE.Group();
  #boxes = new Map<string, THREE.LineSegments>();
  #geometry: THREE.BufferGeometry | null = null;
  #material: THREE.LineBasicMaterial | null = null;

  #enabled: boolean;
  #color: THREE.ColorRepresentation;

  constructor(
    options: ChunkBoundsViewOptions
  ) {
    const {
      parent,
      chunks,
      enabled = false,
      color = kDefaultColor
    } = options;

    this.#parent = parent;
    this.#chunks = chunks;
    this.#enabled = enabled;
    this.#color = color;

    this.#group.name = "VoxelDebugger:chunkBounds";
    if (enabled) {
      parent.add(this.#group);
    }
  }

  get enabled(): boolean {
    return this.#enabled;
  }

  set enabled(value: boolean) {
    if (value === this.#enabled) {
      return;
    }

    this.#enabled = value;
    if (!value) {
      this.clear();
      this.#group.removeFromParent();

      return;
    }

    this.#parent.add(this.#group);
    for (const entry of this.#chunks) {
      this.refresh(entry);
    }
  }

  refresh(
    entry: DebugChunkEntry
  ): void {
    if (!this.#enabled || !entry.bounds || entry.culled) {
      this.release(entry.key);

      return;
    }

    const { origin, size } = entry.bounds;

    let box = this.#boxes.get(entry.key);
    if (!box) {
      box = new THREE.LineSegments(
        this.#resolveGeometry(),
        this.#resolveMaterial()
      );
      box.name = `voxel_chunk_bounds_${entry.key}`;
      this.#boxes.set(entry.key, box);
      this.#group.add(box);
    }
    box.position.set(
      origin.x,
      origin.y,
      origin.z
    );
    box.scale.setScalar(size);
    box.renderOrder = kRenderOrder;
  }

  release(
    key: string
  ): void {
    const box = this.#boxes.get(key);
    if (!box) {
      return;
    }

    this.#group.remove(box);
    this.#boxes.delete(key);
  }

  clear(): void {
    this.#group.clear();
    this.#boxes.clear();
  }

  dispose(): void {
    this.clear();
    this.#group.removeFromParent();
    this.#geometry?.dispose();
    this.#geometry = null;
    this.#material?.dispose();
    this.#material = null;
  }

  #resolveGeometry(): THREE.BufferGeometry {
    if (!this.#geometry) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(kBoxEdgePositions.slice(), 3)
      );
      this.#geometry = geometry;
    }

    return this.#geometry;
  }

  #resolveMaterial(): THREE.LineBasicMaterial {
    this.#material ??= new THREE.LineBasicMaterial({
      color: this.#color,
      depthTest: false,
      depthWrite: false,
      fog: false
    });

    return this.#material;
  }
}
