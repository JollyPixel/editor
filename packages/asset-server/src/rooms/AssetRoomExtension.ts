// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetRoomBinding } from "../kinds/AssetKindHandler.ts";
import {
  assetRoomDeletedSchema,
  ASSET_ROOM_DELETED
} from "./AssetRoomExtension.schema.ts";

export interface AssetRoomMessage {
  readonly type: string;
  readonly data: unknown;
}

export interface AssetRoomDeletedMessage {
  readonly type: typeof ASSET_ROOM_DELETED;
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
  #room: network.RoomBroadcast | null = null;
  #deleted = false;

  constructor(
    binding: AssetRoomBinding,
    protocol: AssetLiveProtocol<TCommand>
  ) {
    super();

    this.id = binding.roomId;
    this.name = binding.kind;
    this.protocols = withDeletedNotice(protocol.protocols);
    this.#assetId = binding.assetId;
    this.#protocol = protocol;
  }

  get deleted(): boolean {
    return this.#deleted;
  }

  markDeleted(): void {
    if (this.#deleted) {
      return;
    }

    this.#deleted = true;
    this.#room?.broadcast({
      type: ASSET_ROOM_DELETED
    } satisfies AssetRoomDeletedMessage);
  }

  override onClientConnect(
    client: network.ClientHandle,
    _peer: network.RoomPeer,
    context: network.RoomContext
  ): void {
    this.#room = context.room;
    if (this.#deleted) {
      client.send({
        type: ASSET_ROOM_DELETED
      } satisfies AssetRoomDeletedMessage);

      return;
    }

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
    if (this.#deleted) {
      return;
    }

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

function withDeletedNotice(
  protocols: network.MessageProtocols
): network.MessageProtocols {
  const { outbound } = protocols;
  if (outbound === null) {
    return protocols;
  }

  return {
    inbound: protocols.inbound,
    outbound: {
      ...outbound,
      schema: {
        oneOf: [
          ...network.variantsOf(outbound.schema),
          assetRoomDeletedSchema
        ]
      }
    }
  };
}
