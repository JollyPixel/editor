// Import Third-party Dependencies
import * as network from "@jolly-pixel/network/client";
import type {
  VoxelEngine,
  VoxelBlockHookEvent,
  VoxelBlockHookListener,
  VoxelLayerHookEvent,
  VoxelLayerHookListener,
  VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  VoxelNetworkCommand,
  VoxelServerMessage,
  VoxelWorldReplaceCommand
} from "./types.ts";

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
    switch (cmd.action) {
      case "world-replace":
        return;
      case "block-defined":
        this.#applyBlockRemotely(() => engine.defineBlock(cmd.block));
        break;
      case "block-removed":
        this.#applyBlockRemotely(() => engine.removeBlock(cmd.blockId));
        break;
      case "block-moved":
        this.#applyBlockRemotely(
          () => engine.moveBlock(cmd.blockId, cmd.toIndex)
        );
        break;
      default:
        engine.applyRemoteCommand(cmd);
        this.notifyLocal(cmd);
    }
  }

  #applyBlockRemotely(
    apply: () => void
  ): void {
    this.#applyingRemote = true;
    try {
      apply();
    }
    finally {
      this.#applyingRemote = false;
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
