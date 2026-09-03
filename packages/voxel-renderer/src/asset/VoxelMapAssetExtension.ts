// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import type { AssetRoomBinding } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { VoxelCommandArbiter } from "../network/VoxelCommandArbiter.ts";
import { isVoxelNetworkCommand } from "../network/VoxelCommandValidator.ts";
import {
  VOXEL_BLOCK_HOOK_ACTIONS,
  VOXEL_LAYER_HOOK_ACTIONS
} from "../hooks.ts";
import type { VoxelMapState } from "./VoxelMapState.ts";
import type { VoxelNetworkCommand } from "../network/types.ts";

export interface VoxelMapAssetExtensionOptions {
  commandEventType: string;
  conflictResolver?: network.ConflictResolver<VoxelNetworkCommand>;
}

/**
 * Appends accepted commands for the asset state store to apply.
 */
export class VoxelMapAssetExtension extends network.Extension {
  readonly id: string;
  readonly name: string;
  readonly events: readonly string[] = [
    ...VOXEL_LAYER_HOOK_ACTIONS,
    ...VOXEL_BLOCK_HOOK_ACTIONS
  ];

  #assetId: string;
  #state: VoxelMapState;
  #commandEventType: string;
  #arbiter: VoxelCommandArbiter;

  constructor(
    binding: AssetRoomBinding<VoxelMapState>,
    options: VoxelMapAssetExtensionOptions
  ) {
    super();

    this.id = binding.roomId;
    this.name = binding.kind;
    this.#assetId = binding.assetId;
    this.#state = binding.state;
    this.#commandEventType = options.commandEventType;
    this.#arbiter = new VoxelCommandArbiter({
      conflictResolver: options.conflictResolver
    });
  }

  onClientConnect(
    client: network.ClientHandle
  ): void {
    client.send({
      type: "snapshot",
      data: this.#state.toJSON()
    });
  }

  onClientDisconnect(
    _clientId: string
  ): void {
    // The room owns client-list bookkeeping.
  }

  override getEventName(
    payload: unknown
  ): string {
    return isVoxelNetworkCommand(payload) ? payload.action : "unknown";
  }

  async onMessage(
    _clientId: string,
    payload: unknown,
    context: network.RoomContext
  ): Promise<void> {
    if (!isVoxelNetworkCommand(payload)) {
      return;
    }

    if (payload.action === "world-replace") {
      if (await this.#append(payload, context)) {
        context.room.broadcast({
          type: "snapshot",
          data: this.#state.toJSON()
        });
      }

      return;
    }

    if (!this.#arbiter.resolve(payload)) {
      return;
    }
    if (!await this.#append(payload, context)) {
      return;
    }

    this.#arbiter.record(payload);
    context.room.broadcast({
      type: "command",
      data: payload
    });
  }

  #append(
    command: VoxelNetworkCommand,
    context: network.RoomContext
  ): Promise<boolean> {
    return context.eventStore.append({
      assetType: this.name,
      assetId: this.#assetId,
      eventType: this.#commandEventType,
      eventData: command
    });
  }
}
