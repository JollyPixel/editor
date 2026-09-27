// Import Internal Dependencies
import type { BlockSurfaceOptions } from "../../blocks/BlockSurface.ts";
import type { VoxelCoord } from "../../world/types.ts";
import type { MeshBuildCounts } from "../MeshBuildStats.ts";
import type { ChunkMeshData } from "../types.ts";
import type { FaceTemplate } from "../pulling/FaceTemplateTable.ts";
import type { MeshDefinitions } from "./MeshDefinitions.ts";

export interface MeshWorkerChunk {
  cx: number;
  cy: number;
  cz: number;
  keys: Int32Array;
  values: Uint32Array;
  count: number;
}

export interface MeshWorkerLayer {
  opacity: number;
  compositing: "replace" | "composite";
  position: VoxelCoord;
  chunks: MeshWorkerChunk[];
}

export interface MeshWorkerMember {
  layer: number;
  cx: number;
  cy: number;
  cz: number;
}

export interface MeshDefinitionsRequest {
  type: "definitions";
  definitions: MeshDefinitions;
}

export interface MeshBuildRequest {
  type: "build";
  id: number;
  chunkSize: number;
  greedy: boolean;
  ambientOcclusion: boolean;
  vertexPulling: boolean;
  layers: MeshWorkerLayer[];
  members: MeshWorkerMember[];
}

export type MeshWorkerRequest =
  | MeshDefinitionsRequest
  | MeshBuildRequest;

export interface MeshWorkerGeometry {
  tilesetId: string;
  surface: BlockSurfaceOptions;
  data: ChunkMeshData;
}

export interface MeshBuildResponse {
  type: "built";
  id: number;
  geometries: MeshWorkerGeometry[];
  stats: MeshBuildCounts;
  templates: FaceTemplate[];
}

export interface MeshBuildFailure {
  type: "failed";
  id: number;
  message: string;
}

export interface MeshWorkerLog {
  type: "log";
  level: "warn" | "error";
  message: string;
  meta?: Record<string, unknown>;
}

export type MeshWorkerResponse =
  | MeshBuildResponse
  | MeshBuildFailure
  | MeshWorkerLog;

export interface MeshWorkerMessageEvent<TData> {
  readonly data: TData;
}

export interface MeshWorkerScope {
  postMessage(
    message: MeshWorkerResponse,
    options?: StructuredSerializeOptions
  ): void;
  addEventListener(
    type: "message",
    listener: (event: MeshWorkerMessageEvent<MeshWorkerRequest>) => void
  ): void;
}

export interface MeshWorkerPort {
  postMessage(
    message: MeshWorkerRequest,
    options?: StructuredSerializeOptions
  ): void;
  addEventListener(
    type: "message",
    listener: (event: MeshWorkerMessageEvent<MeshWorkerResponse>) => void
  ): void;
  addEventListener(
    type: "error",
    listener: (event: Event) => void
  ): void;
  terminate(): void;
}
