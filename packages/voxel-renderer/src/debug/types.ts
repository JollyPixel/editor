// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { MeshBuildStats } from "../mesh/index.ts";

export interface DebugChunkBounds {
  readonly origin: Readonly<THREE.Vector3Like>;
  readonly size: number;
}

export interface DebugChunkEntry {
  readonly key: string;
  readonly meshes: readonly THREE.Mesh[];
  readonly stats: MeshBuildStats;
  readonly bounds: DebugChunkBounds | null;
  culled: boolean;
}

export interface ChunkDebugView {
  refresh(entry: DebugChunkEntry): void;
  release(key: string): void;
  clear(): void;
  dispose(): void;
}
