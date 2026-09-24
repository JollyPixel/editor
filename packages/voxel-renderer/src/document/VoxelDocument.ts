// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type * as THREE from "three";

// Import Internal Dependencies
import { applyVoxelCommand } from "../applyVoxelCommand.ts";
import {
  resolveBlockDefinition,
  type BlockDefinition,
  type BlockProperties,
  type ResolvedBlockDefinition
} from "../blocks/BlockDefinition.ts";
import { BlockRegistry } from "../blocks/BlockRegistry.ts";
import { BlockTextures } from "../blocks/BlockTextures.ts";
import { applyBlockCommand } from "../blocks/applyBlockCommand.ts";
import {
  isVoxelTilesetCommand,
  type VoxelBlockCommand,
  type VoxelCommand,
  type VoxelCommandOrigin
} from "../commands.ts";
import { VoxelHistory } from "../history/VoxelHistory.ts";
import {
  deserializeVoxelWorld,
  serializeVoxelWorld
} from "../serialization/world.ts";
import type { VoxelWorldJSON } from "../serialization/types.ts";
import { TilesetList } from "../tileset/TilesetList.ts";
import type { TilesetDefinition } from "../tileset/types.ts";
import { NOOP_LOGGER, type VoxelLogger } from "../utils/logger.ts";
import { VoxelWorld } from "../world/VoxelWorld.ts";
import { DEFAULT_CHUNK_SIZE } from "../world/VoxelChunk.ts";
import type {
  VoxelApplyOptions,
  VoxelDocumentEvents,
  VoxelDocumentOptions,
  VoxelInvalidation,
  VoxelLoadOptions
} from "./VoxelDocument.types.ts";

type BlockDefinedCommand = Extract<
  VoxelBlockCommand,
  { action: "block-defined"; }
>;

export class VoxelDocument extends Emitter<VoxelDocumentEvents> {
  readonly world: VoxelWorld;
  readonly blocks: BlockRegistry;
  readonly tilesets: TilesetList;
  readonly history: VoxelHistory;

  #logger: VoxelLogger;

  constructor(
    options: VoxelDocumentOptions = {}
  ) {
    const {
      chunkSize = DEFAULT_CHUNK_SIZE,
      layers = [],
      blocks = [],
      tilesets = [],
      history,
      logger = NOOP_LOGGER,
      onCommand
    } = options;
    super();

    if (onCommand) {
      this.on("command", onCommand);
    }

    this.#logger = logger.child({
      namespace: "VoxelDocument"
    });

    this.world = new VoxelWorld(chunkSize);
    this.world.on(
      "command",
      (command) => this.#emitCommand(command, "local")
    );
    layers.forEach((name) => this.world.addLayer(name));
    this.history = new VoxelHistory(this.world, history);

    this.blocks = new BlockRegistry(blocks);
    this.tilesets = new TilesetList();
    for (const tileset of tilesets) {
      this.tilesets.add(tileset);
    }
  }

  get chunkSize(): number {
    return this.world.chunkSize;
  }

  apply(
    command: VoxelCommand,
    options: VoxelApplyOptions = {}
  ): boolean {
    const { origin = "local" } = options;

    const resolved = command.action === "block-defined" ?
      this.#blockDefined(command.block) :
      command;
    const applied = applyVoxelCommand(
      {
        world: this.world,
        blocks: this.blocks,
        tilesets: this.tilesets
      },
      resolved,
      this.#logger
    );
    if (!applied) {
      return false;
    }

    if (isVoxelTilesetCommand(resolved)) {
      this.#invalidate(resolved.action);
    }
    else if (resolved.action === "block-moved") {
      this.#emitCommand({
        ...resolved,
        toIndex: this.blocks.indexOf(resolved.blockId)
      }, origin);

      return true;
    }
    else if (
      resolved.action === "block-defined" ||
      resolved.action === "block-removed"
    ) {
      this.#invalidate(resolved.action);
    }

    this.#emitCommand(resolved, origin);

    return true;
  }

  defineBlock(
    def: BlockDefinition
  ): void {
    this.defineBlocks([def]);
  }

  defineBlocks(
    defs: Iterable<BlockDefinition>
  ): void {
    const commands = Array.from(defs, (def) => this.#blockDefined(def));
    if (commands.length === 0) {
      return;
    }

    for (const command of commands) {
      applyBlockCommand(this.blocks, command);
    }
    this.#invalidate("block-defined");

    for (const command of commands) {
      this.#emitCommand(command, "local");
    }
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

  removeBlock(
    blockId: number
  ): boolean {
    return this.apply({
      action: "block-removed",
      blockId
    });
  }

  moveBlock(
    blockId: number,
    toIndex: number
  ): boolean {
    return this.apply({
      action: "block-moved",
      blockId,
      toIndex
    });
  }

  get defaultTileSize(): number | undefined {
    return this.tilesets.defaultTileSize;
  }

  set defaultTileSize(
    defaultTileSize: number
  ) {
    this.apply({
      action: "default-tile-size-updated",
      defaultTileSize
    });
  }

  addTileset(
    tileset: TilesetDefinition
  ): boolean {
    return this.apply({
      action: "tileset-added",
      tileset
    });
  }

  removeTileset(
    tilesetId: string
  ): boolean {
    return this.apply({
      action: "tileset-removed",
      tilesetId
    });
  }

  resizeTileset(
    tilesetId: string,
    tileSize: number
  ): boolean {
    return this.apply({
      action: "tileset-resized",
      tilesetId,
      tileSize
    });
  }

  registerTileset(
    def: TilesetDefinition
  ): boolean {
    if (!this.tilesets.add(def)) {
      return false;
    }
    this.#invalidate("tileset-registered");

    return true;
  }

  save(): VoxelWorldJSON {
    this.#logger.debug("Serializing world to JSON...");

    return serializeVoxelWorld(this.world, {
      tilesets: this.tilesets,
      defaultTileSize: this.tilesets.defaultTileSize,
      blocks: this.blocks
    });
  }

  load(
    data: VoxelWorldJSON,
    options: VoxelLoadOptions = {}
  ): void {
    this.world.silently(
      () => deserializeVoxelWorld(data, this.world, {
        blocks: this.blocks,
        tilesets: this.tilesets
      })
    );

    for (const def of options.tilesets ?? []) {
      this.tilesets.add(def);
    }

    if (options.mergeLayers) {
      this.world.mergeAllLayers();
    }

    this.history.clear();
    this.emit("loaded");
  }

  dispose(): void {
    this.#logger.debug("Disposing VoxelDocument.");
    this.history.dispose();
    this.tilesets.clear();
    this.world.removeAllListeners();
    this.removeAllListeners();
  }

  #blockDefined(
    block: BlockDefinition
  ): BlockDefinedCommand {
    const resolved = resolveBlockDefinition(block);

    return {
      action: "block-defined",
      block: BlockTextures.of(resolved)
        .withTileset(this.tilesets.defaultTilesetId)
        .applyTo(resolved)
    };
  }

  #emitCommand(
    command: VoxelCommand,
    origin: VoxelCommandOrigin
  ): void {
    this.emit("command", command, { origin });
  }

  #invalidate(
    reason: VoxelInvalidation["reason"]
  ): void {
    this.emit("invalidated", { reason });
  }
}
