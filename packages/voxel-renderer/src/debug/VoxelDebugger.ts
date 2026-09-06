// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { MeshBuildStats } from "../mesh/index.ts";
import { ChunkBoundsView } from "./ChunkBoundsView.ts";
import {
  ChunkWireframeView,
  type VoxelDebugMode
} from "./ChunkWireframeView.ts";
import {
  DebugChunkRegistry,
  type VoxelDebugStats
} from "./DebugChunkRegistry.ts";
import type {
  ChunkDebugView,
  DebugChunkBounds
} from "./types.ts";

export type { VoxelDebugMode } from "./ChunkWireframeView.ts";
export type { VoxelDebugStats } from "./DebugChunkRegistry.ts";
export type { DebugChunkBounds } from "./types.ts";

export interface VoxelDebuggerOptions {
  /**
   * @default "off"
   */
  mode?: VoxelDebugMode;
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
 * Entry point for the debug views. Owns the registry of built chunks and
 * forwards every build to the views drawn from it.
 */
export class VoxelDebugger {
  #chunks = new DebugChunkRegistry();
  #wireframe: ChunkWireframeView;
  #bounds: ChunkBoundsView;
  #views: readonly ChunkDebugView[];

  constructor(
    parent: THREE.Object3D,
    options: VoxelDebuggerOptions = {}
  ) {
    const {
      mode,
      color,
      opacity,
      chunkBounds,
      chunkBoundsColor
    } = options;

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

  get mode(): VoxelDebugMode {
    return this.#wireframe.mode;
  }

  set mode(value: VoxelDebugMode) {
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

  nextMode(): VoxelDebugMode {
    return this.#wireframe.nextMode();
  }

  get stats(): VoxelDebugStats {
    return this.#chunks.stats;
  }

  registerChunk(
    key: string,
    meshes: readonly THREE.Mesh[],
    stats: MeshBuildStats,
    bounds: DebugChunkBounds | null = null
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
