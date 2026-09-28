// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type * as THREE from "three";

// Import Internal Dependencies
import type {
  BlockDefinition,
  BlockProperties,
  ResolvedBlockDefinition
} from "./blocks/BlockDefinition.ts";
import type { BlockRegistry } from "./blocks/BlockRegistry.ts";
import type { BlockShapeRegistry } from "./blocks/shape/BlockShapeRegistry.ts";
import type {
  VoxelCommand,
  VoxelCommandListener
} from "./commands/types.ts";
import {
  VoxelDocument,
  type VoxelApplyOptions,
  type VoxelDocumentOptions
} from "./VoxelDocument.ts";
import type { VoxelHistory } from "./history/VoxelHistory.ts";
import type { VoxelInspector } from "./inspector/index.ts";
import type {
  MaterialGroup,
  MaterialGroupJSON
} from "./materials/MaterialGroup.ts";
import type { MaterialGroupList } from "./materials/MaterialGroupList.ts";
import type { VoxelWorldJSON } from "./serialization/types.ts";
import type { TilesetList } from "./tileset/TilesetList.ts";
import type { TilesetManager } from "./tileset/TilesetManager.ts";
import type {
  TilesetDefinition,
  TilesetTexture
} from "./tileset/types.ts";
import type { VoxelWorld } from "./world/VoxelWorld.ts";
import type {
  VoxelLighting,
  VoxelRange,
  VoxelRendering
} from "./settings/index.ts";
import {
  VoxelView,
  type VoxelViewLoadOptions,
  type VoxelViewOptions
} from "./VoxelView.ts";

export type VoxelEngineEvents = {
  command: VoxelCommandListener;
};

export interface VoxelEngineOptions
  extends Omit<VoxelDocumentOptions, "tilesets">, VoxelViewOptions {
  /**
   * Document to draw. A private one is built from the document options when
   * omitted; every other document option is then ignored.
   */
  document?: VoxelDocument;
}

/**
 * Composes a `VoxelDocument` with the `VoxelView` drawn from it.
 */
export class VoxelEngine extends Emitter<VoxelEngineEvents> {
  readonly document: VoxelDocument;
  readonly view: VoxelView;

  constructor(
    options: VoxelEngineOptions = {}
  ) {
    const {
      document,
      chunkSize,
      layers,
      blocks,
      materialGroups,
      history,
      onCommand,
      logger,
      tilesets,
      ...viewOptions
    } = options;
    super();

    if (onCommand) {
      this.on("command", onCommand);
    }

    this.document = document ?? new VoxelDocument({
      chunkSize,
      layers,
      blocks,
      materialGroups,
      history,
      logger,
      tilesets: Array.from(tilesets ?? [], (source) => source.def)
    });
    this.document.on(
      "command",
      (command, context) => this.emit("command", command, context)
    );
    this.view = new VoxelView(this.document, {
      ...viewOptions,
      logger,
      tilesets
    });
  }

  get root(): THREE.Group {
    return this.view.root;
  }

  get world(): VoxelWorld {
    return this.document.world;
  }

  get blockRegistry(): BlockRegistry {
    return this.document.blocks;
  }

  get history(): VoxelHistory {
    return this.document.history;
  }

  get tilesets(): TilesetList {
    return this.document.tilesets;
  }

  get materialGroups(): MaterialGroupList {
    return this.document.materialGroups;
  }

  get shapeRegistry(): BlockShapeRegistry {
    return this.view.shapes;
  }

  get tilesetManager(): TilesetManager {
    return this.view.tilesetManager;
  }

  get inspector(): VoxelInspector {
    return this.view.inspector;
  }

  get focus(): THREE.Vector3Like | null {
    return this.view.focus;
  }

  set focus(focus: THREE.Vector3Like | null) {
    this.view.focus = focus;
  }

  get range(): VoxelRange {
    return this.view.range;
  }

  get lighting(): VoxelLighting {
    return this.view.lighting;
  }

  get rendering(): VoxelRendering {
    return this.view.rendering;
  }

  get pendingRebuilds(): number {
    return this.view.pendingRebuilds;
  }

  whenIdle(): Promise<void> {
    return this.view.whenIdle();
  }

  init(): void {
    this.view.init();
  }

  tick(
    deltaTime: number
  ): void {
    this.view.tick(deltaTime);
  }

  flush(): void {
    this.view.flush();
  }

  apply(
    command: VoxelCommand,
    options: VoxelApplyOptions = {}
  ): boolean {
    return this.document.apply(command, options);
  }

  defineBlock(
    def: BlockDefinition
  ): void {
    this.document.defineBlock(def);
  }

  defineBlocks(
    defs: Iterable<BlockDefinition>
  ): void {
    this.document.defineBlocks(defs);
  }

  blockAt(
    position: THREE.Vector3Like
  ): ResolvedBlockDefinition | undefined {
    return this.document.blockAt(position);
  }

  blockPropertiesAt(
    position: THREE.Vector3Like
  ): BlockProperties | undefined {
    return this.document.blockPropertiesAt(position);
  }

  removeBlock(
    blockId: number
  ): boolean {
    return this.document.removeBlock(blockId);
  }

  moveBlock(
    blockId: number,
    toIndex: number
  ): boolean {
    return this.document.moveBlock(blockId, toIndex);
  }

  defineMaterialGroup(
    group: MaterialGroup | MaterialGroupJSON
  ): boolean {
    return this.document.defineMaterialGroup(group);
  }

  removeMaterialGroup(
    groupId: string
  ): boolean {
    return this.document.removeMaterialGroup(groupId);
  }

  addTileset(
    tileset: TilesetDefinition
  ): boolean {
    return this.document.addTileset(tileset);
  }

  removeTileset(
    tilesetId: string
  ): boolean {
    return this.document.removeTileset(tilesetId);
  }

  loadTileset(
    def: TilesetDefinition,
    texture: TilesetTexture
  ): void {
    this.view.loadTileset(def, texture);
  }

  markAllChunksDirty(
    source?: string
  ): void {
    this.view.markAllChunksDirty(source);
  }

  save(): VoxelWorldJSON {
    return this.document.save();
  }

  load(
    data: VoxelWorldJSON,
    options: VoxelViewLoadOptions = {}
  ): void {
    this.view.load(data, options);
  }

  dispose(): void {
    this.view.dispose();
    this.document.dispose();
    this.removeAllListeners();
  }
}
