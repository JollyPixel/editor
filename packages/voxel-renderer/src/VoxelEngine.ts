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
} from "./commands.ts";
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
import type { ViewDistance } from "./world/ViewDistance.ts";
import type { VoxelWorld } from "./world/VoxelWorld.ts";
import {
  VoxelView,
  type TileMinification,
  type ViewDistancePolicy,
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

  get viewDistance(): ViewDistance {
    return this.view.viewDistance;
  }

  set viewDistance(viewDistance: ViewDistance) {
    this.view.viewDistance = viewDistance;
  }

  get viewDistancePolicy(): ViewDistancePolicy {
    return this.view.viewDistancePolicy;
  }

  set viewDistancePolicy(policy: ViewDistancePolicy) {
    this.view.viewDistancePolicy = policy;
  }

  get greedy(): boolean {
    return this.view.greedy;
  }

  set greedy(value: boolean) {
    this.view.greedy = value;
  }

  get tileMinification(): TileMinification {
    return this.view.tileMinification;
  }

  set tileMinification(
    value: TileMinification
  ) {
    this.view.tileMinification = value;
  }

  get ambientOcclusion(): number {
    return this.view.ambientOcclusion;
  }

  set ambientOcclusion(
    value: number
  ) {
    this.view.ambientOcclusion = value;
  }

  get castShadow(): boolean {
    return this.view.castShadow;
  }

  set castShadow(
    value: boolean
  ) {
    this.view.castShadow = value;
  }

  get receiveShadow(): boolean {
    return this.view.receiveShadow;
  }

  set receiveShadow(
    value: boolean
  ) {
    this.view.receiveShadow = value;
  }

  get pendingRebuilds(): number {
    return this.view.pendingRebuilds;
  }

  whenIdle(): Promise<void> {
    return this.view.whenIdle();
  }

  get defaultTileSize(): number | undefined {
    return this.document.defaultTileSize;
  }

  set defaultTileSize(defaultTileSize: number) {
    this.document.defaultTileSize = defaultTileSize;
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

  resizeTileset(
    tilesetId: string,
    tileSize: number
  ): boolean {
    return this.document.resizeTileset(tilesetId, tileSize);
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
