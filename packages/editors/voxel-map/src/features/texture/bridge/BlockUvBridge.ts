// Import Third-party Dependencies
import {
  resolvedBlockTextureSlots,
  type ResolvedBlockDefinition,
  type VoxelEngine
} from "@jolly-pixel/voxel.renderer";
import type {
  UVMap,
  UVMapListener,
  UVRegion,
  UVRegionData
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  blockFromUvRegion,
  blockIdFromUvRegion,
  blockUsesTileset,
  blockUvRegion,
  uncollapsedBlockUvRegion,
  uvRegionsEqual
} from "../uv/blockUvProjection.ts";
import { blockShapeUv } from "../uv/blockShapeUv.ts";
import { BlockUvSelectionSync } from "./BlockUvSelectionSync.ts";
import {
  editorState,
  type BrushStore,
  type WorldStore
} from "../../../app/state/index.ts";

export interface BlockUvBridgeOptions {
  runLocalRestore?: <T>(fn: () => T) => T;
  brush?: BrushStore;
  worldStore?: WorldStore;
}

/** Keeps block texture definitions and pixel-editor UV regions in sync. */
export class BlockUvBridge {
  readonly #uv: UVMap;
  readonly #engine: VoxelEngine;
  readonly #selection: BlockUvSelectionSync;
  readonly #runLocalRestore: <T>(fn: () => T) => T;
  #tilesetId: string | null = null;
  #tileSize = 1;
  #rebuilding = false;
  #applying = false;
  #unsubscribeRegistry: () => void;

  constructor(
    uv: UVMap,
    engine: VoxelEngine,
    options: BlockUvBridgeOptions = {}
  ) {
    this.#uv = uv;
    this.#engine = engine;
    const worldStore = options.worldStore ?? editorState.world;
    this.#selection = new BlockUvSelectionSync(
      uv,
      options.brush ?? editorState.brush
    );
    this.#runLocalRestore = options.runLocalRestore ?? ((fn) => fn());

    this.#uv.on("region-moved", this.#onRegionMoved);
    this.#uv.on("region-dragging", this.#onRegionDragging);
    this.#uv.on("region-state-changed", this.#onRegionStateChanged);
    this.#uv.on("region-deleted", this.#onRegionDeleted);
    this.#unsubscribeRegistry = worldStore.watch(
      "blockRegistryChanged",
      this.#onBlockRegistryChanged
    );
  }

  setActiveTileset(
    tilesetId: string,
    tileSize: number
  ): void {
    if (this.#tilesetId === tilesetId && this.#tileSize === tileSize) {
      return;
    }
    this.#tilesetId = tilesetId;
    this.#tileSize = tileSize;
    this.#rebuild();
  }

  dispose(): void {
    this.#uv.off("region-moved", this.#onRegionMoved);
    this.#uv.off("region-dragging", this.#onRegionDragging);
    this.#uv.off("region-state-changed", this.#onRegionStateChanged);
    this.#uv.off("region-deleted", this.#onRegionDeleted);
    this.#unsubscribeRegistry();
    this.#selection.dispose();
  }

  #blocksOnActiveTileset(): ResolvedBlockDefinition[] {
    const tilesetId = this.#tilesetId;
    if (tilesetId === null) {
      return [];
    }

    return [...this.#engine.blockRegistry.getAll()].filter(
      (block) => blockUsesTileset(
        block,
        this.#engine.shapeRegistry.get(block.shapeId),
        tilesetId
      )
    );
  }

  #regionFor(
    block: ResolvedBlockDefinition
  ): UVRegion {
    return blockUvRegion(
      block,
      this.#engine.shapeRegistry.get(block.shapeId),
      this.#tileSize
    );
  }

  #rebuild(): void {
    const desired = new Map(
      this.#blocksOnActiveTileset().map((block) => {
        const region = this.#regionFor(block);

        return [region.id, region] as const;
      })
    );
    this.#rebuilding = true;
    try {
      this.#runLocalRestore(() => {
        for (const region of [...this.#uv.regions]) {
          if (
            blockIdFromUvRegion(region.id) !== null &&
            !desired.has(region.id)
          ) {
            this.#uv.delete(region.id);
          }
        }
        for (const region of desired.values()) {
          const existing = this.#uv.get(region.id);
          if (!existing || !uvRegionsEqual(existing, region)) {
            this.#uv.restore(region);
          }
        }
      });
    }
    finally {
      this.#rebuilding = false;
    }

    this.#selection.refresh();
  }

  #restoreRegionFor(
    block: ResolvedBlockDefinition
  ): void {
    const region = this.#regionFor(block);
    const existing = this.#uv.get(region.id);
    if (existing && uvRegionsEqual(existing, region)) {
      return;
    }

    this.#uv.restore(region);
  }

  #applyRegionToBlock(
    region: UVRegion
  ): void {
    const blockId = blockIdFromUvRegion(region.id);
    if (blockId === null) {
      return;
    }

    const block = this.#engine.blockRegistry.get(blockId);
    if (!block) {
      return;
    }

    const updated = blockFromUvRegion(
      block,
      this.#engine.shapeRegistry.get(block.shapeId),
      region,
      this.#tileSize
    );

    this.#applying = true;
    try {
      this.#engine.defineBlock(updated);
    }
    finally {
      this.#applying = false;
    }
  }

  readonly #onBlockRegistryChanged = (): void => {
    if (!this.#applying) {
      this.#rebuild();
    }
  };

  readonly #onRegionMoved: UVMapListener<"region-moved"> = (event) => {
    const block = this.#blockOf(event.region.id);
    if (!block || uvRegionsEqual(this.#regionFor(block), event.region)) {
      return;
    }

    this.#applyRegionToBlock(event.region);
  };

  readonly #onRegionDragging: UVMapListener<"region-dragging"> = (event) => {
    if (this.#rebuilding) {
      return;
    }

    const block = this.#blockOf(event.id);
    const region = this.#uv.get(event.id);
    if (!block || !region) {
      return;
    }

    const dragged = region.withRect(
      event.rect,
      event.face ?? undefined
    );
    if (uvRegionsEqual(this.#regionFor(block), dragged)) {
      return;
    }

    this.#applyRegionToBlock(dragged);
  };

  readonly #onRegionStateChanged: UVMapListener<
    "region-state-changed"
  > = (event) => {
    if (this.#rebuilding) {
      return;
    }
    const block = this.#blockOf(event.region.id);
    if (!block || this.#rederivedOnUncollapse(block, event)) {
      return;
    }

    this.#applyRegionToBlock(event.region);
  };

  #rederivedOnUncollapse(
    block: ResolvedBlockDefinition,
    event: { region: UVRegion; previous: UVRegionData; }
  ): boolean {
    const wasCollapsed = (event.previous.state ?? "collapsed") === "collapsed";
    if (event.region.state !== "uncollapsed" || !wasCollapsed) {
      return false;
    }

    const shape = this.#engine.shapeRegistry.get(block.shapeId);
    if (shape === undefined || blockShapeUv(shape).isBox) {
      return false;
    }

    const derived = uncollapsedBlockUvRegion(
      block,
      shape,
      this.#tileSize
    );
    this.#rebuilding = true;
    try {
      this.#runLocalRestore(() => this.#uv.restore(derived));
    }
    finally {
      this.#rebuilding = false;
    }
    this.#applyRegionToBlock(derived);

    return true;
  }

  #blockOf(
    id: string
  ): ResolvedBlockDefinition | undefined {
    const blockId = blockIdFromUvRegion(id);
    if (blockId === null) {
      return undefined;
    }

    const block = this.#engine.blockRegistry.get(blockId);
    if (!block) {
      return undefined;
    }
    const shape = this.#engine.shapeRegistry.get(block.shapeId);

    return shape && resolvedBlockTextureSlots(block, shape).length > 0 ?
      block :
      undefined;
  }

  readonly #onRegionDeleted: UVMapListener<"region-deleted"> = (event) => {
    if (this.#rebuilding) {
      return;
    }

    const blockId = blockIdFromUvRegion(event.region.id);
    if (blockId === null) {
      return;
    }

    const block = this.#engine.blockRegistry.get(blockId);
    if (!block) {
      return;
    }

    this.#restoreRegionFor(block);
    this.#selection.refresh();
  };
}
