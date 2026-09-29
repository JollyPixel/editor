// Import Third-party Dependencies
import type * as THREE from "three";
import { disposeObject3D } from "@jolly-pixel/engine";
import type {
  BlockPieces,
  ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BlockRenderSources } from "./BlockRenderSources.ts";
import { buildBlockPreviewMesh } from "./blockPreviewMesh.ts";

// CONSTANTS
const kOpacityCheckIntervalMs = 250;

export interface BlockPreviewEntry {
  readonly block: ResolvedBlockDefinition;
  readonly mesh: THREE.Mesh;
  readonly emptySlots: string;
}

export class BlockPreviewMeshes {
  readonly #scene: THREE.Scene;
  readonly #sources: BlockRenderSources;
  readonly #pieces: BlockPieces;
  #entries: BlockPreviewEntry[] = [];
  #atlasVersion: number;
  #groupsVersion: number;
  #checkedAt = 0;

  constructor(
    scene: THREE.Scene,
    sources: BlockRenderSources
  ) {
    this.#scene = scene;
    this.#sources = sources;
    this.#pieces = sources.createPieces();
    this.#atlasVersion = sources.atlases.version;
    this.#groupsVersion = sources.materialGroups?.version ?? -1;
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
    const atlasVersion = this.#sources.atlases.version;
    const groupsVersion = this.#sources.materialGroups?.version ?? -1;
    if (atlasVersion !== this.#atlasVersion) {
      this.#atlasVersion = atlasVersion;
      this.#rebuild(() => true);
    }
    else if (groupsVersion !== this.#groupsVersion) {
      this.#groupsVersion = groupsVersion;
      this.#rebuild((entry) => entry.block.materialGroup !== undefined);
    }
    else if (time - this.#checkedAt >= kOpacityCheckIntervalMs) {
      this.#checkedAt = time;
      this.#rebuild(
        (entry) => this.#emptySlotsOf(entry.block) !== entry.emptySlots
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
    mesh.visible = false;
    this.#scene.add(mesh);

    return {
      block,
      mesh,
      emptySlots: this.#emptySlotsOf(block)
    };
  }

  #emptySlotsOf(
    block: ResolvedBlockDefinition
  ): string {
    return this.#pieces.emptySlotsOf(block).join(",");
  }

  #remove(
    entry: BlockPreviewEntry
  ): void {
    this.#scene.remove(entry.mesh);
    disposeObject3D(entry.mesh);
  }
}
