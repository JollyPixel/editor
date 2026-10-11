// Import Internal Dependencies
import type { VoxelLayer } from "../../document/world/VoxelLayer.ts";
import type { VoxelWorld } from "../../document/world/VoxelWorld.ts";
import type { ChunkMeshWorkers } from "../workers/ChunkMeshWorkers.ts";
import type {
  ChunkMeshLayout,
  ChunkMeshTarget
} from "./ChunkMeshLayout.ts";
import type { ChunkMeshStore } from "./ChunkMeshStore.ts";
import { ChunkRebuildQueue } from "./ChunkRebuildQueue.ts";
import type { ChunkViewport } from "./ChunkViewport.ts";
import { ChunkVisibility } from "./ChunkVisibility.ts";

export interface ChunkPipelineOptions {
  world: VoxelWorld;
  layout: ChunkMeshLayout;
  meshes: ChunkMeshStore;
  workers: ChunkMeshWorkers | null;
  budgetMs: number;
}

interface ChunkPipelineStep {
  budgetMs: number;
  offload: boolean;
  reclaim: boolean;
}

export class ChunkPipeline {
  #world: VoxelWorld;
  #layout: ChunkMeshLayout;
  #meshes: ChunkMeshStore;
  #workers: ChunkMeshWorkers | null;
  #budgetMs: number;
  #queue = new ChunkRebuildQueue();
  #visibility: ChunkVisibility;
  #idleWaiters: Array<() => void> = [];
  #viewport: ChunkViewport | null = null;
  #scannedViewport: ChunkViewport | null = null;
  #scannedRevisions = new Map<VoxelLayer, number>();

  constructor(
    options: ChunkPipelineOptions
  ) {
    this.#world = options.world;
    this.#layout = options.layout;
    this.#meshes = options.meshes;
    this.#workers = options.workers;
    this.#budgetMs = options.budgetMs;
    this.#visibility = new ChunkVisibility({
      meshes: this.#meshes,
      unload: (key, entry) => {
        this.#queue.cancel(key);
        this.#workers?.cancel(key);
        this.#meshes.unload(key);
        for (const { chunk } of entry.members) {
          chunk.dirty = true;
        }
      }
    });
  }

  get pendingRebuilds(): number {
    return this.#queue.size + (this.#workers?.pending ?? 0);
  }

  get #offloads(): boolean {
    return this.#workers !== null && !this.#workers.broken;
  }

  tick(
    viewport: ChunkViewport
  ): void {
    this.#step(viewport, {
      budgetMs: this.#budgetMs,
      offload: this.#offloads,
      reclaim: false
    });
  }

  flush(
    viewport: ChunkViewport
  ): void {
    this.#step(viewport, {
      budgetMs: 0,
      offload: false,
      reclaim: true
    });
  }

  rebuildAll(
    viewport: ChunkViewport
  ): void {
    this.#queue.clear();
    this.#workers?.reclaim();
    this.#world.markAllDirty();
    if (!this.#offloads) {
      this.flush(viewport);
    }
  }

  refill(): void {
    const viewport = this.#viewport;
    if (viewport === null || !this.#offloads) {
      return;
    }

    this.#queue.drain(
      this.#budgetMs,
      (target) => this.#rebuild(target, viewport, true)
    );
  }

  whenIdle(
    viewport: ChunkViewport
  ): Promise<void> {
    if (this.#isIdle(viewport)) {
      return Promise.resolve();
    }

    const { promise, resolve } = Promise.withResolvers<void>();
    this.#idleWaiters.push(resolve);

    return promise;
  }

  clear(): void {
    this.#workers?.reclaim();
    this.#meshes.clear();
    this.#visibility.reset();
    this.#scannedViewport = null;
  }

  dispose(): void {
    this.#queue.clear();
    this.clear();
    this.#workers?.dispose();
  }

  #step(
    viewport: ChunkViewport,
    step: ChunkPipelineStep
  ): void {
    this.#viewport = viewport;
    this.#visibility.update(viewport);
    this.#installCompleted(viewport);
    if (step.reclaim) {
      for (const target of this.#workers?.reclaim() ?? []) {
        this.#queue.push(target);
      }
    }
    this.#enqueueDirtyChunks(viewport);
    this.#queue.drain(
      step.budgetMs,
      (target) => this.#rebuild(target, viewport, step.offload)
    );
    this.#settleIdleWaiters(viewport);
  }

  #installCompleted(
    viewport: ChunkViewport
  ): void {
    for (const completed of this.#workers?.takeCompleted() ?? []) {
      if (completed.kind === "built") {
        this.#meshes.install(
          completed.plan,
          completed.geometries,
          completed.stats
        );
      }
      else {
        this.#meshes.rebuild(completed.target, viewport);
      }
    }
  }

  #isIdle(
    viewport: ChunkViewport
  ): boolean {
    if (this.pendingRebuilds > 0) {
      return false;
    }

    for (const layer of this.#world.getLayers()) {
      for (const chunk of layer.getDirtyChunks()) {
        if (viewport.contains(this.#layout.chunkWorldOrigin(layer, chunk), false)) {
          return false;
        }
      }
    }

    return true;
  }

  #settleIdleWaiters(
    viewport: ChunkViewport
  ): void {
    if (this.#idleWaiters.length === 0 || !this.#isIdle(viewport)) {
      return;
    }

    for (const resolve of this.#idleWaiters.splice(0)) {
      resolve();
    }
  }

  #enqueueDirtyChunks(
    viewport: ChunkViewport
  ): void {
    let grew = false;

    for (const { chunk } of this.#world.getAllChunksToBeRemoved()) {
      const placed = this.#meshes.targetContaining(chunk);
      if (placed !== undefined) {
        grew = this.#retire(placed) || grew;
      }
    }

    if (this.#dirtyChunksChangedSinceScan(viewport)) {
      grew = this.#enqueueAdmittedDirtyChunks(viewport) || grew;
    }

    if (viewport.focus === null) {
      return;
    }

    if (grew || this.#queue.focusMovedSinceSort(viewport)) {
      this.#queue.sortBy(viewport);
    }
  }

  #dirtyChunksChangedSinceScan(
    viewport: ChunkViewport
  ): boolean {
    if (
      this.#scannedViewport === null ||
      viewport.differsFrom(this.#scannedViewport)
    ) {
      return true;
    }

    const layers = this.#world.getLayers();

    return layers.length !== this.#scannedRevisions.size ||
      layers.some(
        (layer) => this.#scannedRevisions.get(layer) !== layer.dirtyRevision
      );
  }

  #enqueueAdmittedDirtyChunks(
    viewport: ChunkViewport
  ): boolean {
    let grew = false;

    for (const { layer, chunk } of this.#world.getAllDirtyChunks()) {
      const origin = this.#layout.chunkWorldOrigin(layer, chunk);
      if (!viewport.contains(origin, false)) {
        continue;
      }

      chunk.dirty = false;
      const target = this.#layout.resolveTarget(layer, chunk);
      const placed = this.#meshes.targetContaining(chunk);
      if (placed !== undefined && placed.key !== target?.key) {
        grew = this.#retire(placed) || grew;
      }
      if (target !== null) {
        grew = this.#queue.push(target) || grew;
      }
    }

    this.#scannedViewport = viewport;
    this.#scannedRevisions.clear();
    for (const layer of this.#world.getLayers()) {
      this.#scannedRevisions.set(layer, layer.dirtyRevision);
    }

    return grew;
  }

  #rebuild(
    target: ChunkMeshTarget,
    viewport: ChunkViewport,
    offload: boolean
  ): boolean {
    if (!viewport.contains(target.origin, false)) {
      const members = this.#layout.collectMembers(target);
      if (members.length > 0) {
        for (const { chunk } of members) {
          chunk.dirty = true;
        }

        return true;
      }
    }

    const workers = this.#workers;
    if (!offload || workers === null) {
      this.#meshes.rebuild(target, viewport);

      return true;
    }
    if (!workers.hasCapacity) {
      return false;
    }

    const plan = this.#meshes.plan(target, viewport);
    if (plan !== null && !workers.dispatch(plan)) {
      this.#meshes.build(plan);
    }

    return true;
  }

  #retire(
    target: ChunkMeshTarget
  ): boolean {
    if (target.kind === "cell") {
      return this.#queue.push(target);
    }

    this.#queue.cancel(target.key);
    this.#workers?.cancel(target.key);
    this.#meshes.remove(target.key);

    return false;
  }
}
