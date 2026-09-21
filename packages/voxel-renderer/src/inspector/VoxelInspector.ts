// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import type { MeshBuildStats } from "../mesh/index.ts";
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import { ChunkBoundsView } from "./ChunkBoundsView.ts";
import { VoxelBlockInspector } from "./VoxelBlockInspector.ts";
import {
  ChunkWireframeView,
  type VoxelInspectorMode
} from "./ChunkWireframeView.ts";
import {
  InspectedChunkRegistry,
  type VoxelMeshStats
} from "./InspectedChunkRegistry.ts";
import { voxelMetrics } from "./voxelMetrics.ts";
import type { VoxelMetric } from "./VoxelMetric.ts";
import type {
  ChunkInspectorView,
  InspectedChunkBounds
} from "./types.ts";

export type { VoxelMetric } from "./VoxelMetric.ts";
export type { VoxelInspectorMode } from "./ChunkWireframeView.ts";
export type { VoxelMeshStats } from "./InspectedChunkRegistry.ts";
export type { InspectedChunkBounds } from "./types.ts";

export interface VoxelInspectorContext {
  parent: THREE.Object3D;
  world: VoxelWorld;
  blockRegistry: BlockRegistry;
}

export interface VoxelMeshInspector {
  readonly stats: VoxelMeshStats;
}

export interface VoxelInspectorOptions {
  /**
   * @default "off"
   */
  mode?: VoxelInspectorMode;
  /**
   * Wireframe color.
   * @default 0x66FF99
   */
  color?: THREE.ColorRepresentation;
  /**
   * Wireframe opacity, `1` disables blending.
   * @default 0.5
   */
  opacity?: number;
  /**
   * Outlines the boundary of every registered chunk. Independent of `mode`.
   * @default false
   */
  chunkBounds?: boolean;
  /**
   * Chunk boundary color.
   * @default 0xFF3B30
   */
  chunkBoundsColor?: THREE.ColorRepresentation;
}

/**
 * Entry point for the inspector views. Owns the registry of built chunks and
 * forwards every build to the views drawn from it.
 */
export class VoxelInspector {
  readonly mesh: VoxelMeshInspector;
  readonly blocks: VoxelBlockInspector;
  readonly metrics: readonly VoxelMetric[];

  #chunks = new InspectedChunkRegistry();
  #wireframe: ChunkWireframeView;
  #bounds: ChunkBoundsView;
  #views: readonly ChunkInspectorView[];

  constructor(
    context: VoxelInspectorContext,
    options: VoxelInspectorOptions = {}
  ) {
    const { parent, world, blockRegistry } = context;
    const {
      mode,
      color,
      opacity,
      chunkBounds,
      chunkBoundsColor
    } = options;

    this.mesh = this.#chunks;
    this.metrics = voxelMetrics(this.#chunks);
    this.blocks = new VoxelBlockInspector({
      world,
      blockRegistry
    });
    this.#wireframe = new ChunkWireframeView({
      parent,
      chunks: this.#chunks,
      mode,
      color,
      opacity
    });
    this.#bounds = new ChunkBoundsView({
      parent,
      chunks: this.#chunks,
      enabled: chunkBounds,
      color: chunkBoundsColor
    });
    this.#views = [
      this.#wireframe,
      this.#bounds
    ];
  }

  get mode(): VoxelInspectorMode {
    return this.#wireframe.mode;
  }

  set mode(value: VoxelInspectorMode) {
    this.#wireframe.mode = value;
  }

  get enabled(): boolean {
    return this.#wireframe.enabled;
  }

  set enabled(value: boolean) {
    this.#wireframe.enabled = value;
  }

  get chunkBounds(): boolean {
    return this.#bounds.enabled;
  }

  set chunkBounds(value: boolean) {
    this.#bounds.enabled = value;
  }

  nextMode(): VoxelInspectorMode {
    return this.#wireframe.nextMode();
  }

  registerChunk(
    key: string,
    meshes: readonly THREE.Mesh[],
    stats: MeshBuildStats,
    bounds: InspectedChunkBounds | null = null
  ): void {
    this.unregisterChunk(key);

    const entry = this.#chunks.register(
      key,
      meshes,
      stats,
      bounds
    );
    for (const view of this.#views) {
      view.refresh(entry);
    }
  }

  cullChunk(
    key: string,
    culled: boolean
  ): void {
    const entry = this.#chunks.cull(key, culled);
    if (!entry) {
      return;
    }

    for (const view of this.#views) {
      view.refresh(entry);
    }
  }

  unregisterChunk(
    key: string
  ): void {
    if (!this.#chunks.unregister(key)) {
      return;
    }

    for (const view of this.#views) {
      view.release(key);
    }
  }

  clear(): void {
    this.#chunks.clear();
    for (const view of this.#views) {
      view.clear();
    }
  }

  dispose(): void {
    this.#chunks.clear();
    for (const view of this.#views) {
      view.dispose();
    }
  }
}
