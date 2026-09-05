// Import Third-party Dependencies
import * as network from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { VoxelEngine } from "../VoxelEngine.ts";
import type {
  VoxelBlockHookEvent,
  VoxelBlockHookListener,
  VoxelLayerHookEvent,
  VoxelLayerHookListener
} from "../hooks.ts";
import type { VoxelWorldJSON } from "../serialization/types.ts";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage,
  VoxelWorldReplaceCommand
} from "./types.ts";
import { isVoxelBlockCommand } from "./VoxelCommandValidator.ts";

export interface VoxelSyncClientOptions {
  room: network.Room<VoxelNetworkCommand, VoxelServerMessage>;
}

export class VoxelSyncClient extends network.SyncAdapter<
  VoxelEngine,
  VoxelLayerHookEvent,
  VoxelNetworkCommand,
  VoxelWorldJSON
> {
  #engine: VoxelEngine | undefined;
  #previousBlockHandler: VoxelBlockHookListener | undefined;
  #applyingRemote = false;

  constructor(
    options: VoxelSyncClientOptions
  ) {
    super(options.room);
  }

  override attach(
    engine: VoxelEngine
  ): void {
    super.attach(engine);

    this.#engine = engine;
    this.#previousBlockHandler = engine.onBlockUpdated;
    engine.onBlockUpdated = (event) => {
      this.#previousBlockHandler?.(event);
      if (!this.#applyingRemote) {
        this.room.send(
          this.stampCommand<VoxelBlockHookEvent>(event)
        );
      }
    };
  }

  override detach(): void {
    if (this.#engine) {
      this.#engine.onBlockUpdated = this.#previousBlockHandler;
      this.#previousBlockHandler = undefined;
      this.#engine = undefined;
    }

    super.detach();
  }

  protected getHandler(
    engine: VoxelEngine
  ): VoxelLayerHookListener | undefined {
    return engine.onLayerUpdated;
  }

  protected setHandler(
    engine: VoxelEngine,
    fn: VoxelLayerHookListener | undefined
  ): void {
    engine.onLayerUpdated = fn;
  }

  protected applySnapshot(
    engine: VoxelEngine,
    snapshot: VoxelWorldJSON
  ): void {
    engine.load(snapshot);
  }

  protected applyRemoteCommand(
    engine: VoxelEngine,
    cmd: VoxelNetworkCommand
  ): void {
    if (cmd.action === "world-replace") {
      return;
    }

    if (isVoxelBlockCommand(cmd)) {
      this.#applyingRemote = true;
      try {
        if (cmd.action === "block-removed") {
          engine.removeBlock(cmd.blockId);
        }
        else {
          engine.defineBlock(cmd.block);
        }
      }
      finally {
        this.#applyingRemote = false;
      }
    }
    else {
      engine.applyRemoteCommand(cmd);
      this.notifyLocal(cmd);
    }
  }

  replaceWorld(
    data: VoxelWorldJSON
  ): void {
    this.room.send(
      this.stampCommand<VoxelWorldReplaceCommand>({
        action: "world-replace",
        data
      })
    );
  }

  override destroy(): void {
    super.destroy();
    this.room.leave();
  }
}
