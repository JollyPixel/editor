// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { modelProtocols } from "./ModelCommand.schema.ts";
import { ModelCommandArbiter } from "./ModelCommandArbiter.ts";
import { applyModelCommand } from "./applyModelCommand.ts";
import type {
  ModelNetworkCommand,
  ModelNodeJSON
} from "./types.ts";

export interface ModelSyncServerOptions {
  /** @default "voxel-model" */
  id?: string;
  /** @default network.LastWriteWinsResolver */
  conflictResolver?: network.ConflictResolver<ModelNetworkCommand>;
}

export class ModelSyncServer extends network.Extension<ModelNetworkCommand> {
  readonly id: string;
  readonly name = "voxel-model";
  readonly protocols = modelProtocols;

  #nodes = new Map<string, ModelNodeJSON>();
  #arbiter: ModelCommandArbiter;

  constructor(
    options: ModelSyncServerOptions = {}
  ) {
    super();
    const {
      id = "voxel-model",
      conflictResolver
    } = options;

    this.id = id;
    this.#arbiter = new ModelCommandArbiter({ conflictResolver });
  }

  override onClientConnect(
    client: network.ClientHandle
  ): void {
    client.send({
      type: "snapshot",
      data: this.snapshot()
    });
  }

  override onMessage(
    _clientId: string,
    command: ModelNetworkCommand,
    context: network.RoomContext
  ): void {
    this.receive(command, context);
  }

  receive(
    cmd: ModelNetworkCommand,
    context: network.RoomContext
  ): void {
    const admitted = this.#arbiter.admit(cmd);
    if (admitted === null) {
      return;
    }

    if (admitted.action !== "group-added" && !this.#nodes.has(admitted.uuid)) {
      return;
    }

    applyModelCommand(this.#nodes, admitted);
    this.#arbiter.record(admitted);

    context.room.broadcast({
      type: "command",
      data: cmd
    });
  }

  snapshot(): ModelNodeJSON[] {
    return [...this.#nodes.values()];
  }
}
