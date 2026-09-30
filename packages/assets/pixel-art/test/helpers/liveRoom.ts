// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { AssetRoom } from "@jolly-pixel/asset";
import {
  AssetRoomExtension,
  foldAssetEvent,
  type AssetKindHandler,
  type AssetRoomBinding
} from "@jolly-pixel/asset-server";
import type { RoomContext } from "@jolly-pixel/network";

// CONSTANTS
const kAssetId = "asset-1";

export class LiveRoom<TState, TCommand> {
  readonly state: TState;
  readonly extension: AssetRoomExtension<TCommand>;

  #inboxes = new Map<string, unknown[]>();
  #context: RoomContext = {
    room: {
      broadcast: (payload) => {
        for (const inbox of this.#inboxes.values()) {
          inbox.push(payload);
        }
      },
      sendTo: (clientId, payload) => this.#inboxes.get(clientId)?.push(payload)
    },
    identity: {
      subject: "subject",
      role: "default"
    }
  };

  constructor(
    handler: AssetKindHandler<TState, TCommand>
  ) {
    this.state = handler.create(kAssetId);
    const store = EventStore.persistence.memory();
    store.subscribe((event) => foldAssetEvent(handler, this.state, event));
    const binding: AssetRoomBinding<TState> = {
      assetId: kAssetId,
      kind: handler.kind,
      roomId: new AssetRoom(handler.kind, kAssetId).toString(),
      state: this.state
    };
    const commands = handler.commands!;
    this.extension = new AssetRoomExtension(
      binding,
      commands,
      commands.live!(binding),
      store.writer
    );
  }

  connect(
    clientId: string
  ): void {
    const inbox: unknown[] = [];
    this.#inboxes.set(clientId, inbox);
    this.extension.onClientConnect(
      {
        id: clientId,
        send: (payload) => inbox.push(payload)
      },
      {
        clientId,
        identity: this.#context.identity,
        profile: {},
        presence: {}
      },
      this.#context
    );
  }

  receive(
    clientId: string,
    payload: unknown
  ): void {
    this.extension.onMessage(clientId, payload, this.#context);
  }

  resync(
    clientId: string
  ): void {
    this.extension.onResync(clientId, this.#context);
  }

  take(
    clientId: string
  ): unknown[] {
    return this.#inboxes.get(clientId)?.splice(0) ?? [];
  }
}
