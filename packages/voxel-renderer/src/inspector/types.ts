// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { MeshBuildStats } from "../mesh/index.ts";

export interface InspectedChunkBounds {
  readonly origin: Readonly<THREE.Vector3Like>;
  readonly size: number;
}

export interface InspectedChunkEntry {
  readonly key: string;
  readonly meshes: readonly THREE.Mesh[];
  readonly stats: MeshBuildStats;
  readonly bounds: InspectedChunkBounds | null;
  culled: boolean;
}

export interface ChunkInspectorView {
  refresh(entry: InspectedChunkEntry): void;
  release(key: string): void;
  clear(): void;
  dispose(): void;
}
