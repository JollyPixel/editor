// Import Third-party Dependencies
import type * as THREE from "three";
import { disposeObject3D } from "@jolly-pixel/engine";
import type {
  BlockPieces,
  ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BlockRenderSources } from "./BlockRenderSources.ts";
import type { BlockRenderChanges } from "./BlockRenderChanges.ts";
import { buildBlockPreviewMesh } from "./blockPreviewMesh.ts";

// CONSTANTS
const kOpacityCheckIntervalMs = 250;

export interface BlockPreviewEntry {
  readonly block: ResolvedBlockDefinition;
  readonly mesh: THREE.Mesh;
  readonly emptySlots: string;
}

export class BlockPreviewMeshes {
  readonly #sources: BlockRenderSources;
  readonly #pieces: BlockPieces;
  readonly #changes: BlockRenderChanges;
  #entries: BlockPreviewEntry[] = [];
  #checkedAt = 0;

  constructor(
    sources: BlockRenderSources
  ) {
    this.#sources = sources;
    this.#pieces = sources.createPieces();
    this.#changes = sources.watchChanges();
  }

  get entries(): readonly BlockPreviewEntry[] {
    return this.#entries;
  }

  sync(
    blocks: readonly ResolvedBlockDefinition[]
  ): void {
    const previous = new Map(
      this.#entries.map((entry) => [entry.block.id, entry])
    );
    this.#entries = blocks.map((block) => {
      const existing = previous.get(block.id);
      previous.delete(block.id);
      if (existing?.block === block) {
        return existing;
      }
      if (existing !== undefined) {
        this.#remove(existing);
      }

      return this.#create(block);
    });

    for (const entry of previous.values()) {
      this.#remove(entry);
    }
  }

  refresh(
    time: number
  ): void {
    const change = this.#changes.poll();
    if (change === "atlases") {
      this.#rebuild(() => true);
    }
    else if (change === "materialGroups") {
      this.#rebuild((entry) => entry.block.materialGroup !== undefined);
    }
    else if (time - this.#checkedAt >= kOpacityCheckIntervalMs) {
      this.#checkedAt = time;
      this.#rebuild(
        (entry) => this.#findEmptySlots(entry.block) !== entry.emptySlots
      );
    }
  }

  dispose(): void {
    for (const entry of this.#entries) {
      this.#remove(entry);
    }
    this.#entries = [];
  }

  #rebuild(
    stale: (entry: BlockPreviewEntry) => boolean
  ): void {
    this.#entries = this.#entries.map((entry) => {
      if (!stale(entry)) {
        return entry;
      }

      this.#remove(entry);

      return this.#create(entry.block);
    });
  }

  #create(
    block: ResolvedBlockDefinition
  ): BlockPreviewEntry {
    const mesh = buildBlockPreviewMesh(
      block,
      this.#pieces,
      this.#sources.materialGroups
    );

    return {
      block,
      mesh,
      emptySlots: this.#findEmptySlots(block)
    };
  }

  #findEmptySlots(
    block: ResolvedBlockDefinition
  ): string {
    return this.#pieces.findEmptySlots(block).join(",");
  }

  #remove(
    entry: BlockPreviewEntry
  ): void {
    disposeObject3D(entry.mesh);
  }
}
