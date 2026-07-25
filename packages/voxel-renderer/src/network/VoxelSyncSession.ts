// Import Internal Dependencies
import type { VoxelEngine } from "../VoxelEngine.ts";
import type {
  VoxelLayerHookEvent,
  VoxelLayerHookListener
} from "../hooks.ts";
import type { VoxelTransport } from "./VoxelTransport.ts";
import type {
  VoxelNetworkCommand,
  VoxelServerMessage
} from "./types.ts";

export interface VoxelSyncSessionOptions {
  transport: VoxelTransport;
}

/**
 * Synchronizes a single `VoxelEngine` over one transport connection.
 * The transport is scoped to one world.
 */
export class VoxelSyncSession {
  #transport: VoxelTransport;
  #engine: VoxelEngine | undefined;
  #previousHandler: VoxelLayerHookListener | undefined;
  #seq = 0;

  constructor(
    options: VoxelSyncSessionOptions
  ) {
    this.#transport = options.transport;
    this.#transport.onMessage = (message) => this.#handleMessage(message);
  }

  attach(
    engine: VoxelEngine
  ): void {
    if (this.#engine) {
      throw new Error("An engine is already attached to this session");
    }

    this.#engine = engine;
    this.#previousHandler = engine.onLayerUpdated;
    engine.onLayerUpdated = (event) => {
      this.#previousHandler?.(event);
      this.#transport.send(
        this.#stamp(event)
      );
    };
  }

  detach(): void {
    if (!this.#engine) {
      return;
    }

    this.#engine.onLayerUpdated = this.#previousHandler;
    this.#previousHandler = undefined;
    this.#engine = undefined;
  }

  #stamp(
    event: VoxelLayerHookEvent
  ): VoxelNetworkCommand {
    return {
      ...event,
      clientId: this.#transport.clientId,
      seq: ++this.#seq,
      timestamp: Date.now()
    };
  }

  #handleMessage(
    message: VoxelServerMessage
  ): void {
    switch (message.type) {
      case "snapshot":
        this.#engine?.load(message.data);
        break;
      case "command":
        this.#handleRemote(message.data);
        break;
    }
  }

  #handleRemote(
    cmd: VoxelNetworkCommand
  ): void {
    if (cmd.clientId === this.#transport.clientId) {
      return;
    }

    this.#engine?.applyRemoteCommand(cmd);
  }

  destroy(): void {
    this.detach();
    this.#transport.onMessage = null;
  }
}
