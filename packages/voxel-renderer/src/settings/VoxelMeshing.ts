// Import Internal Dependencies
import type { MeshWorkerOptions } from "../render/ChunkMeshWorkers.ts";

export interface VoxelMeshingOptions {
  /**
   * Per-tick rebuild budget in milliseconds; 0 drains the queue.
   * @default 8
   */
  budgetMs?: number;

  /**
   * Meshes chunks in Web Workers on cross-origin isolated pages; meshing
   * stays on the main thread when omitted or unavailable.
   */
  workers?: MeshWorkerOptions;
}
