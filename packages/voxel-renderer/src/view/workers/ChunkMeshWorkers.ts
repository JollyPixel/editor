// Import Internal Dependencies
import { BlockSurface } from "../../document/blocks/BlockSurface.ts";
import {
  ChunkGeometryKey,
  MeshBuildStats,
  PULLED_TEMPLATE_BITS,
  PulledChunkGeometry,
  type PulledMeshData,
  type VoxelMeshBuilder
} from "../meshing/index.ts";
import {
  captureMeshDefinitions,
  meshDefinitionsVersion,
  type MeshDefinitionSources
} from "./MeshDefinitions.ts";
import type {
  MeshBuildFailure,
  MeshBuildRequest,
  MeshBuildResponse,
  MeshWorkerChunk,
  MeshWorkerLayer,
  MeshWorkerPort,
  MeshWorkerResponse
} from "./protocol.ts";
import type { VoxelLogger } from "../../VoxelLogger.ts";
import type { VoxelChunk } from "../../document/world/storage/VoxelChunk.ts";
import type { VoxelLayer } from "../../document/world/VoxelLayer.ts";
import type { VoxelWorld } from "../../document/world/VoxelWorld.ts";
import type { ChunkMeshTarget } from "../chunks/ChunkMeshLayout.ts";
import type { ChunkRebuildPlan } from "../chunks/ChunkMeshStore.ts";
import {
  AUTHORED_LAYER_VISIBILITY,
  type MeshableLayerVisibility
} from "../meshing/types.ts";

// CONSTANTS
const kJobsPerWorker = 2;
const kNeighbourSpan = 3;
const kTemplateMask = (1 << PULLED_TEMPLATE_BITS) - 1;

export interface MeshWorkerOptions {
  createWorker: () => MeshWorkerPort;
  count?: number;
}

export interface ChunkMeshWorkersContext {
  world: VoxelWorld;
  meshBuilder: VoxelMeshBuilder;
  definitions: MeshDefinitionSources;
  logger: VoxelLogger;
  onCapacity?: () => void;
  visibility?: MeshableLayerVisibility;
}

export type ChunkMeshWorkersOptions = MeshWorkerOptions & ChunkMeshWorkersContext;

export interface BuiltChunkMesh {
  kind: "built";
  plan: ChunkRebuildPlan;
  geometries: Map<ChunkGeometryKey, PulledChunkGeometry>;
  stats: MeshBuildStats;
}

export interface RetriedChunkMesh {
  kind: "retry";
  target: ChunkMeshTarget;
}

export type CompletedChunkMesh =
  | BuiltChunkMesh
  | RetriedChunkMesh;

interface MeshWorkerSlot {
  port: MeshWorkerPort;
  running: number;
  templateIds: number[];
}

interface MeshJob {
  id: number;
  plan: ChunkRebuildPlan;
  slot: MeshWorkerSlot;
  definitionsVersion: string;
  chunks: VoxelChunk[];
  revisions: number[];
  response: MeshBuildResponse | MeshBuildFailure | null;
}

export function sharedMemoryAvailable(): boolean {
  return typeof SharedArrayBuffer === "function" &&
    globalThis.crossOriginIsolated !== false;
}

export class ChunkMeshWorkers {
  #options: ChunkMeshWorkersOptions;
  #slots: MeshWorkerSlot[] = [];
  #running = new Map<number, MeshJob>();
  #latest = new Map<string, MeshJob>();
  #settled: MeshJob[] = [];
  #nextId = 1;
  #definitionsVersion: string | null = null;
  #broken = false;
  #reported = new Set<string>();

  static create(
    options: MeshWorkerOptions | undefined,
    context: ChunkMeshWorkersContext
  ): ChunkMeshWorkers | null {
    if (options === undefined) {
      return null;
    }
    if (!sharedMemoryAvailable()) {
      context.logger.warn(
        "Mesh workers need SharedArrayBuffer (a cross-origin isolated page); " +
        "meshing stays on the main thread."
      );

      return null;
    }

    return new ChunkMeshWorkers({
      ...options,
      ...context
    });
  }

  constructor(
    options: ChunkMeshWorkersOptions
  ) {
    this.#options = options;
  }

  get broken(): boolean {
    return this.#broken;
  }

  get pending(): number {
    return this.#latest.size;
  }

  get hasCapacity(): boolean {
    if (this.#broken) {
      return false;
    }

    return this.#slots.length === 0 ||
      this.#slots.some((slot) => slot.running < kJobsPerWorker);
  }

  dispatch(
    plan: ChunkRebuildPlan
  ): boolean {
    this.#spawn();
    const slot = this.#idleSlot();
    if (slot === undefined) {
      return false;
    }
    const job: MeshJob = {
      id: this.#nextId++,
      plan,
      slot,
      definitionsVersion: this.#syncDefinitions(),
      chunks: [],
      revisions: [],
      response: null
    };
    const request = this.#request(job);
    slot.running++;
    this.#running.set(job.id, job);
    this.#latest.set(plan.target.key, job);
    slot.port.postMessage(request);

    return true;
  }

  cancel(
    key: string
  ): void {
    this.#latest.delete(key);
  }

  reclaim(): ChunkMeshTarget[] {
    const targets = [...this.#latest.values()].map((job) => job.plan.target);
    this.#latest.clear();
    this.#settled = [];

    return targets;
  }

  takeCompleted(): CompletedChunkMesh[] {
    const completed: CompletedChunkMesh[] = [];
    for (const job of this.#settled.splice(0)) {
      const { target } = job.plan;
      if (this.#latest.get(target.key) !== job) {
        continue;
      }
      this.#latest.delete(target.key);

      const { response } = job;
      if (response === null || response.type === "failed") {
        completed.push({ kind: "retry", target });
      }
      else if (this.#isStale(job)) {
        for (const { chunk } of job.plan.members) {
          chunk.dirty = true;
        }
      }
      else {
        completed.push(this.#built(job, response));
      }
    }

    return completed;
  }

  dispose(): void {
    for (const { port } of this.#slots) {
      port.terminate();
    }
    this.#slots = [];
    this.#running.clear();
    this.#latest.clear();
    this.#settled = [];
  }

  #spawn(): void {
    if (this.#slots.length > 0) {
      return;
    }

    const { createWorker, count = defaultWorkerCount() } = this.#options;
    try {
      for (let index = 0; index < Math.max(1, count); index++) {
        const port = createWorker();
        const slot: MeshWorkerSlot = {
          port,
          running: 0,
          templateIds: []
        };
        port.addEventListener("message", ({ data }) => this.#receive(slot, data));
        port.addEventListener("error", (event) => this.#fail(describeError(event)));
        this.#slots.push(slot);
      }
    }
    catch (error) {
      this.#fail(error instanceof Error ? error.message : String(error));
    }
  }

  #idleSlot(): MeshWorkerSlot | undefined {
    let idle: MeshWorkerSlot | undefined;
    for (const slot of this.#slots) {
      if (
        slot.running < kJobsPerWorker &&
        (idle === undefined || slot.running < idle.running)
      ) {
        idle = slot;
      }
    }

    return idle;
  }

  #syncDefinitions(): string {
    const { definitions, meshBuilder } = this.#options;
    const version = meshDefinitionsVersion(definitions);
    if (version === this.#definitionsVersion) {
      return version;
    }

    this.#definitionsVersion = version;
    for (const block of definitions.blockRegistry) {
      meshBuilder.writeRegions(block.id);
    }
    const request = {
      type: "definitions" as const,
      definitions: captureMeshDefinitions(
        definitions,
        meshBuilder.faceTemplates.regions.assignments()
      )
    };
    for (const slot of this.#slots) {
      slot.templateIds = [];
      slot.port.postMessage(request);
    }

    return version;
  }

  #request(
    job: MeshJob
  ): MeshBuildRequest {
    const {
      world,
      meshBuilder,
      visibility = AUTHORED_LAYER_VISIBILITY
    } = this.#options;
    const { chunkSize } = world;
    const { members } = job.plan;
    const layers: MeshWorkerLayer[] = [];
    const indices = new Map<VoxelLayer, number>();

    for (const layer of world.getLayers()) {
      const chunks = visibility.isVisible(layer) ?
        this.#shareWindow(job, layer) :
        [];
      if (chunks.length === 0) {
        continue;
      }

      const { position } = layer;
      indices.set(layer, layers.length);
      layers.push({
        compositing: layer.compositing,
        position: {
          x: position.x,
          y: position.y,
          z: position.z
        },
        chunks
      });
    }

    return {
      type: "build",
      id: job.id,
      chunkSize,
      ambientOcclusion: meshBuilder.ambientOcclusion,
      layers,
      members: members.map(({ layer, chunk }) => {
        return {
          layer: indices.get(layer) ?? -1,
          cx: chunk.cx,
          cy: chunk.cy,
          cz: chunk.cz
        };
      })
    };
  }

  #shareWindow(
    job: MeshJob,
    layer: VoxelLayer
  ): MeshWorkerChunk[] {
    const shift = Math.log2(this.#options.world.chunkSize);
    const { origin } = job.plan;
    const { position } = layer;
    const baseCx = (origin.x - 1 - position.x) >> shift;
    const baseCy = (origin.y - 1 - position.y) >> shift;
    const baseCz = (origin.z - 1 - position.z) >> shift;
    const chunks: MeshWorkerChunk[] = [];

    for (let dx = 0; dx < kNeighbourSpan; dx++) {
      for (let dy = 0; dy < kNeighbourSpan; dy++) {
        for (let dz = 0; dz < kNeighbourSpan; dz++) {
          const chunk = layer.getChunk(baseCx + dx, baseCy + dy, baseCz + dz);
          if (chunk !== undefined) {
            chunks.push(this.#share(job, chunk));
          }
        }
      }
    }

    return chunks;
  }

  #share(
    job: MeshJob,
    chunk: VoxelChunk
  ): MeshWorkerChunk {
    chunk.share();
    job.chunks.push(chunk);
    job.revisions.push(chunk.revision);

    const { store, partners } = chunk;
    const shared: MeshWorkerChunk = {
      cx: chunk.cx,
      cy: chunk.cy,
      cz: chunk.cz,
      keys: store.keys,
      values: store.values,
      count: store.size
    };
    if (partners !== null && partners.size > 0) {
      shared.partners = {
        keys: partners.keys,
        values: partners.values,
        count: partners.size
      };
    }

    return shared;
  }

  #receive(
    slot: MeshWorkerSlot,
    response: MeshWorkerResponse
  ): void {
    if (response.type === "log") {
      this.#log(response.level, response.message, response.meta);

      return;
    }

    const job = this.#running.get(response.id);
    if (job === undefined) {
      return;
    }

    this.#running.delete(response.id);
    slot.running--;
    job.response = response;
    if (response.type === "failed") {
      this.#log("error", `Mesh worker failed: ${response.message}`);
    }
    else if (job.definitionsVersion === this.#definitionsVersion) {
      const { faceTemplates } = this.#options.meshBuilder;
      for (const template of response.templates) {
        slot.templateIds.push(faceTemplates.idOf(template));
      }
    }
    if (this.#latest.get(job.plan.target.key) === job) {
      this.#settled.push(job);
    }
    this.#options.onCapacity?.();
  }

  #fail(
    message: string
  ): void {
    if (this.#broken) {
      return;
    }

    this.#broken = true;
    this.#options.logger.error(
      `Mesh worker crashed; meshing falls back to the main thread: ${message}`
    );
    for (const job of this.#running.values()) {
      job.slot.running--;
      if (this.#latest.get(job.plan.target.key) === job) {
        this.#settled.push(job);
      }
    }
    this.#running.clear();
    for (const { port } of this.#slots) {
      port.terminate();
    }
  }

  #isStale(
    job: MeshJob
  ): boolean {
    const { chunks, revisions, definitionsVersion } = job;

    return definitionsVersion !== meshDefinitionsVersion(this.#options.definitions) ||
      chunks.some((chunk, index) => chunk.revision !== revisions[index]);
  }

  #built(
    job: MeshJob,
    response: MeshBuildResponse
  ): BuiltChunkMesh {
    const { meshBuilder } = this.#options;
    const { plan, slot } = job;
    const geometries = new Map<ChunkGeometryKey, PulledChunkGeometry>();
    for (const { blocksetId, surface, blended, data } of response.geometries) {
      remapTemplates(data, slot.templateIds);
      geometries.set(
        new ChunkGeometryKey(blocksetId, new BlockSurface(surface), blended),
        meshBuilder.createGeometry(data)
      );
    }

    const stats = new MeshBuildStats();
    stats.copyFrom(response.stats);

    return {
      kind: "built",
      plan,
      geometries,
      stats
    };
  }

  #log(
    level: "warn" | "error",
    message: string,
    meta?: Record<string, unknown>
  ): void {
    if (this.#reported.has(message)) {
      return;
    }

    this.#reported.add(message);
    this.#options.logger[level](message, meta);
  }
}

function defaultWorkerCount(): number {
  const cores = globalThis.navigator?.hardwareConcurrency ?? 2;

  return Math.max(1, cores - 1);
}

function describeError(
  event: Event
): string {
  return "message" in event && typeof event.message === "string" ?
    event.message :
    event.type;
}

function remapTemplates(
  data: PulledMeshData,
  templateIds: readonly number[]
): void {
  const { words, faceCount } = data;
  const faceWords = PulledChunkGeometry.faceWordsOf(data);
  for (let face = 0; face < faceCount; face++) {
    const index = (face * faceWords) + 1;
    const packed = words[index];
    words[index] = (
      (packed & ~kTemplateMask) | templateIds[packed & kTemplateMask]
    ) >>> 0;
  }
}
