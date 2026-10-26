// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { AssetRoom } from "@jolly-pixel/asset";
import {
  describeErrors,
  MessageParser,
  type RoomContext
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  AssetKindHandler,
  AssetRoomBinding
} from "../model/kinds/AssetKindHandler.ts";
import type { AssetCommandHeader } from "../model/kinds/AssetLiveProtocol.ts";
import { foldAssetEvent } from "../model/kinds/foldAssetEvent.ts";
import { AssetRoomExtension } from "../live/AssetRoomExtension.ts";
import { AssetRoomProtocols } from "../live/AssetRoomProtocols.ts";
import type { AssetServerMessage } from "./MockAssetRoom.ts";

// CONSTANTS
const kAssetId = "asset-1";

export class LiveAssetRoom<
  TState,
  TCommand extends AssetCommandHeader,
  TRelay extends object = never
> {
  readonly state: TState;
  readonly extension: AssetRoomExtension<TCommand, TRelay>;

  #inbound: MessageParser<TCommand | TRelay>;
  #outbound: MessageParser<AssetServerMessage<TCommand, unknown>>;
  #inboxes = new Map<string, unknown[]>();
  #context: RoomContext = {
    room: {
      broadcast: (payload) => {
        for (const inbox of this.#inboxes.values()) {
          inbox.push(payload);
        }
      },
      sendTo: (clientId, payload) => {
        this.#inboxes.get(clientId)?.push(payload);
      }
    },
    identity: {
      subject: "subject",
      role: "default"
    }
  };

  constructor(
    handler: AssetKindHandler<TState, TCommand, TRelay>
  ) {
    const { commands } = handler;
    if (commands?.live === undefined) {
      throw new TypeError(`Asset kind "${handler.kind}" has no live commands.`);
    }

    this.state = handler.create(kAssetId);
    const store = EventStore.persistence.memory();
    store.subscribe(
      (event) => foldAssetEvent(handler, this.state, event, store.reader)
    );
    const binding: AssetRoomBinding<TState> = {
      assetId: kAssetId,
      kind: handler.kind,
      roomId: new AssetRoom(handler.kind, kAssetId).toString(),
      state: this.state
    };
    const live = commands.live(binding);
    const protocols = AssetRoomProtocols
      .compile(commands)
      .withSnapshot(live.snapshotSchema, live.parts?.schema);
    this.#inbound = MessageParser.fromProtocol(protocols.inbound);
    this.#outbound = MessageParser.fromProtocol(protocols.outbound);
    this.extension = new AssetRoomExtension(
      binding,
      commands,
      live,
      store.writer,
      { parts: handler.parts }
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
    const parsed = this.#inbound.parse(payload);
    if (parsed.err) {
      throw new TypeError(
        `Message from "${clientId}" does not parse: ${describeErrors(parsed.val)}`
      );
    }

    this.extension.onMessage(clientId, parsed.val.message, this.#context);
  }

  resync(
    clientId: string
  ): void {
    this.extension.onResync(clientId, this.#context);
  }

  take<TSnapshot = unknown>(
    clientId: string
  ): AssetServerMessage<TCommand, TSnapshot>[] {
    const parser = this.#outbound as MessageParser<
      AssetServerMessage<TCommand, TSnapshot>
    >;
    const payloads = this.#inboxes.get(clientId)?.splice(0) ?? [];

    return payloads.map((payload) => {
      const parsed = parser.parse(payload);
      if (parsed.err) {
        throw new TypeError(
          `The room sent a message that does not parse: ${describeErrors(parsed.val)}`
        );
      }

      return parsed.val.message;
    });
  }
}
