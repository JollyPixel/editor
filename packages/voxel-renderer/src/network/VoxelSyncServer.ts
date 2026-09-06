// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { VoxelWorld } from "../world/VoxelWorld.ts";
import {
  deserializeVoxelWorld,
  serializeVoxelWorld
} from "../serialization/world.ts";
import type { VoxelWorldJSON } from "../serialization/types.ts";
import {
  VOXEL_BLOCK_HOOK_ACTIONS,
  VOXEL_LAYER_HOOK_ACTIONS,
  type VoxelLayerHookAction
} from "../hooks.ts";
import { BlockRegistry } from "../blocks/BlockRegistry.ts";
import {
  isVoxelBlockCommand,
  isVoxelNetworkCommand
} from "./VoxelCommandValidator.ts";
import { VoxelCommandArbiter } from "./VoxelCommandArbiter.ts";
import { applyBlockCommand } from "./applyBlockCommand.ts";
import type { VoxelNetworkCommand } from "./types.ts";

// CONSTANTS
const kVoxelMutationActions = new Set<VoxelLayerHookAction>([
  "voxel-set",
  "voxel-removed",
  "voxels-set",
  "voxels-removed"
]);

export type ClientHandle = network.ClientHandle;

export interface VoxelSyncServerOptions {
  /**
   * Extension ID; use one server and ID per world.
   * @default "voxel-map"
   */
  id?: string;
  /**
   * Authoritative world; omission creates a new one.
   */
  world?: VoxelWorld;
  /**
   * Chunk size for the new world (ignored when `world` is provided).
   * @default 16
   */
  chunkSize?: number;
  /**
   * Custom conflict resolver.
   * @default network.LastWriteWinsResolver
   */
  conflictResolver?: network.ConflictResolver<VoxelNetworkCommand>;
  /**
   * Authoritative block definitions; omission creates an empty registry.
   */
  blocks?: BlockRegistry;
}

export class VoxelSyncServer extends network.Extension {
  readonly id: string;
  readonly name = "voxel.renderer";
  readonly world: VoxelWorld;
  readonly blocks: BlockRegistry;
  readonly events: readonly string[] = [
    ...VOXEL_LAYER_HOOK_ACTIONS,
    ...VOXEL_BLOCK_HOOK_ACTIONS
  ];

  #arbiter: VoxelCommandArbiter;

  constructor(
    options: VoxelSyncServerOptions = {}
  ) {
    super();
    const {
      id = "voxel-map",
      world,
      chunkSize = 16,
      conflictResolver,
      blocks
    } = options;

    this.id = id;
    this.world = world ?? new VoxelWorld(chunkSize);
    this.blocks = blocks ?? new BlockRegistry();
    this.#arbiter = new VoxelCommandArbiter({
      conflictResolver
    });
  }

  onClientConnect(
    client: network.ClientHandle
  ): void {
    client.send({
      type: "snapshot",
      data: this.snapshot()
    });
  }

  onClientDisconnect(
    _clientId: string
  ): void {
    // The room owns client bookkeeping.
  }

  getEventName(
    payload: unknown
  ): string {
    return isVoxelNetworkCommand(payload)
      ? payload.action
      : "unknown";
  }

  onMessage(
    _clientId: string,
    payload: unknown,
    context: network.RoomContext
  ): void {
    if (!isVoxelNetworkCommand(payload)) {
      return;
    }

    this.receive(
      payload,
      context
    );
  }

  receive(
    cmd: VoxelNetworkCommand,
    context: network.RoomContext
  ): void {
    if (cmd.action === "world-replace") {
      deserializeVoxelWorld(
        cmd.data,
        this.world,
        { blocks: this.blocks }
      );

      context.room.broadcast({
        type: "snapshot",
        data: this.snapshot()
      });

      return;
    }

    const admitted = this.#arbiter.admit(cmd);
    if (admitted === null) {
      return;
    }

    if (isVoxelBlockCommand(admitted)) {
      applyBlockCommand(this.blocks, admitted);
    }
    else {
      // A peer may have removed the layer while the command was in flight.
      if (
        kVoxelMutationActions.has(admitted.action) &&
        this.world.getLayer(admitted.layerName) === undefined
      ) {
        return;
      }

      this.world.applyRemoteCommand(admitted);
    }

    this.#arbiter.record(admitted);
    this.#broadcast(admitted, context);
  }

  #broadcast(
    cmd: VoxelNetworkCommand,
    context: network.RoomContext
  ): void {
    context.room.broadcast({
      type: "command",
      data: cmd
    });
  }

  snapshot(): VoxelWorldJSON {
    return serializeVoxelWorld(this.world, {
      blocks: this.blocks
    });
  }
}
