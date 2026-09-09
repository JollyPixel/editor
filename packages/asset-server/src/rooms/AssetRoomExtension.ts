// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetRoomBinding } from "../kinds/AssetKindHandler.ts";

export interface AssetRoomMessage {
  readonly type: string;
  readonly data: unknown;
}

export interface AssetArbitration<TCommand = unknown> {
  readonly command: TCommand;
  commit?(): void;
}

export interface AssetLiveProtocol<TCommand = unknown> {
  readonly commandEventType: string;
  readonly protocols: network.MessageProtocols;

  parse(
    payload: unknown
  ): TCommand | null;

  snapshot(): unknown;

  arbitrate(
    command: TCommand,
    clientId: string
  ): AssetArbitration<TCommand> | null;

  broadcast?(
    command: TCommand
  ): AssetRoomMessage;
}

export class AssetRoomExtension<
  TCommand = unknown
> extends network.Extension {
  readonly id: string;
  readonly name: string;
  readonly protocols: network.MessageProtocols;

  #assetId: string;
  #protocol: AssetLiveProtocol<TCommand>;

  constructor(
    binding: AssetRoomBinding,
    protocol: AssetLiveProtocol<TCommand>
  ) {
    super();

    this.id = binding.roomId;
    this.name = binding.kind;
    this.protocols = protocol.protocols;
    this.#assetId = binding.assetId;
    this.#protocol = protocol;
  }

  override onClientConnect(
    client: network.ClientHandle
  ): void {
    client.send({
      type: "snapshot",
      data: this.#protocol.snapshot()
    });
  }

  override async onMessage(
    clientId: string,
    payload: unknown,
    context: network.RoomContext
  ): Promise<void> {
    const command = this.#protocol.parse(payload);
    if (command === null) {
      return;
    }

    const arbitration = this.#protocol.arbitrate(command, clientId);
    if (arbitration === null) {
      return;
    }

    const appended = await context.eventStore.append({
      assetType: this.name,
      assetId: this.#assetId,
      eventType: this.#protocol.commandEventType,
      eventData: arbitration.command
    });
    if (!appended) {
      return;
    }

    arbitration.commit?.();
    context.room.broadcast(
      this.#protocol.broadcast?.(arbitration.command) ?? {
        type: "command",
        data: arbitration.command
      }
    );
  }
}
