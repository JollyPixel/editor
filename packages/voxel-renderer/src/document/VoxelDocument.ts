// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import {
  BlockDocument,
  type BlockCatalogCommand,
  type BlockDocumentEvents
} from "./BlockDocument.ts";
import { applyVoxelCommand } from "./commands/applyVoxelCommand.ts";
import type {
  BlockDefinition,
  BlockProperties,
  ResolvedBlockDefinition
} from "./blocks/BlockDefinition.ts";
import { BlockRegistry } from "./blocks/BlockRegistry.ts";
import type {
  VoxelCommand,
  VoxelCommandListener
} from "./commands/types.ts";
import {
  VoxelHistory,
  type VoxelHistoryOptions
} from "./VoxelHistory.ts";
import type { MaterialGroupJSON } from "./materials/MaterialGroup.ts";
import { MaterialGroupList } from "./materials/MaterialGroupList.ts";
import type { BlendGroupJSON } from "./materials/BlendGroup.ts";
import { BlendGroupList } from "./materials/BlendGroupList.ts";
import {
  deserializeVoxelWorld,
  serializeVoxelWorld
} from "./serialization/world.ts";
import type { VoxelWorldJSON } from "./serialization/types.ts";
import { BlocksetList } from "./blocksets/BlocksetList.ts";
import type { BlocksetDefinition } from "./blocksets/types.ts";
import { NOOP_LOGGER, type VoxelLogger } from "../VoxelLogger.ts";
import {
  VoxelWorld,
  type VoxelMergeAllLayersOptions
} from "./world/VoxelWorld.ts";
import { DEFAULT_CHUNK_SIZE } from "./world/storage/VoxelChunk.ts";

export interface VoxelLoadOptions {
  /**
   * Collapses layers before rendering; higher-priority voxels win overlaps.
   * Layers named in `except` stay apart and split the merge around them.
   */
  mergeLayers?: boolean | VoxelMergeAllLayersOptions;

  /**
   * Blockset definitions declared before loading a world that uses them.
   */
  blocksets?: Iterable<BlocksetDefinition>;
}

export type VoxelDocumentEvents = BlockDocumentEvents<VoxelCommand>;

export interface VoxelDocumentOptions {
  /**
   * Chunk edge length in voxels; must be a power of two.
   * @default 16
   */
  chunkSize?: number;

  /**
   * Layer names added in order, so the last one ends up on top.
   * @default []
   */
  layers?: string[];

  /**
   * Block definitions registered before any command is applied.
   * @default []
   */
  blocks?: BlockDefinition[];

  /**
   * Blockset definitions declared before any texture is registered for them.
   */
  blocksets?: Iterable<BlocksetDefinition>;

  /**
   * Material groups the blocks can name through `materialGroup`.
   * @default []
   */
  materialGroups?: Iterable<MaterialGroupJSON>;

  /**
   * Blend groups the blocks can name through `blendGroup`.
   * @default []
   */
  blendGroups?: Iterable<BlendGroupJSON>;

  /**
   * Undo/redo of voxel edits made through `VoxelWorld`; disabled by default.
   */
  history?: VoxelHistoryOptions;

  /**
   * Debug logger; defaults to a no-op implementation.
   */
  logger?: VoxelLogger;

  /**
   * Subscribed to the `"command"` event before any command is applied.
   */
  onCommand?: VoxelCommandListener;
}

/**
 * A world with the blocks, material groups and blend groups its blocksets
 * project into it. Saving and loading cover the world and its blockset links
 * only; blocks and groups are runtime state a host fills from blockset
 * documents.
 */
export class VoxelDocument extends BlockDocument<VoxelCommand> {
  readonly world: VoxelWorld;
  readonly blocksets: BlocksetList;
  readonly history: VoxelHistory;

  #logger: VoxelLogger;

  constructor(
    options: VoxelDocumentOptions = {}
  ) {
    const {
      chunkSize = DEFAULT_CHUNK_SIZE,
      layers = [],
      blocks = [],
      blocksets = [],
      materialGroups = [],
      blendGroups = [],
      history,
      logger = NOOP_LOGGER,
      onCommand
    } = options;
    super(
      new BlockRegistry(blocks),
      new MaterialGroupList(materialGroups),
      new BlendGroupList(blendGroups)
    );

    if (onCommand) {
      this.on("command", onCommand);
    }

    this.#logger = logger.child({
      namespace: "VoxelDocument"
    });

    this.world = new VoxelWorld(chunkSize);
    this.world.on(
      "command",
      (command) => this.emit("command", command, { origin: "local" })
    );
    layers.forEach((name) => this.world.addLayer(name));
    this.history = new VoxelHistory(this.world, history);

    this.blocksets = new BlocksetList();
    for (const blockset of blocksets) {
      this.blocksets.add(blockset);
    }
  }

  get chunkSize(): number {
    return this.world.chunkSize;
  }

  blockAt(
    position: THREE.Vector3Like
  ): ResolvedBlockDefinition | undefined {
    const entry = this.world.getVoxelAt(position);

    return entry && this.blocks.get(entry.blockId);
  }

  blockPropertiesAt(
    position: THREE.Vector3Like
  ): BlockProperties | undefined {
    const entry = this.world.getVoxelAt(position);

    return entry && this.blocks.propertiesOf(entry.blockId);
  }

  addBlockset(
    blockset: BlocksetDefinition
  ): boolean {
    return this.apply({
      action: "blockset-added",
      blockset
    });
  }

  removeBlockset(
    blocksetId: string
  ): boolean {
    return this.apply({
      action: "blockset-removed",
      blocksetId
    });
  }

  save(): VoxelWorldJSON {
    this.#logger.debug("Serializing world to JSON...");

    return serializeVoxelWorld(this.world, {
      blocksets: this.blocksets
    });
  }

  load(
    data: VoxelWorldJSON,
    options: VoxelLoadOptions = {}
  ): void {
    this.world.silently(
      () => deserializeVoxelWorld(data, this.world, {
        blocksets: this.blocksets
      })
    );

    for (const def of options.blocksets ?? []) {
      this.blocksets.add(def);
    }

    if (options.mergeLayers) {
      this.#mergeLayers(
        options.mergeLayers === true ? {} : options.mergeLayers
      );
    }

    this.history.clear();
    this.emit("loaded");
  }

  dispose(): void {
    this.#logger.debug("Disposing VoxelDocument.");
    this.history.dispose();
    this.blocksets.clear();
    this.world.removeAllListeners();
    this.removeAllListeners();
  }

  #mergeLayers(
    options: VoxelMergeAllLayersOptions
  ): void {
    const except = [...options.except ?? []];
    for (const name of except) {
      if (!this.world.getLayer(name)) {
        this.#logger.warn(
          `Cannot keep unknown layer '${name}' out of the merge.`
        );
      }
    }

    this.world.mergeAllLayers({ except });
  }

  protected fold(
    command: VoxelCommand | BlockCatalogCommand
  ): VoxelCommand | null {
    return applyVoxelCommand(this, command, this.#logger);
  }
}
