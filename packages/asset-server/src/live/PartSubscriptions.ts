// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetParts } from "../model/kinds/AssetKindHandler.ts";
import {
  ASSET_ROOM_PARTS,
  ASSET_ROOM_SUBSCRIBE_PARTS,
  type AssetCommandHeader,
  type AssetLiveParts,
  type AssetPartsRequest,
  type AssetRoomPartsMessage
} from "../model/kinds/AssetLiveProtocol.ts";

type Send = (message: AssetRoomPartsMessage) => void;

export interface PartSubscriptionsOptions<
  TCommand extends AssetCommandHeader
> {
  readonly parts: AssetParts<unknown, TCommand>;
  readonly live: AssetLiveParts<TCommand>;
  readonly members: ReadonlySet<string>;
  readonly version: () => number | undefined;
  readonly partsOnJoin: readonly string[];
}

export class PartSubscriptions<
  TCommand extends AssetCommandHeader = AssetCommandHeader
> {
  #parts: AssetParts<unknown, TCommand>;
  #live: AssetLiveParts<TCommand>;
  #members: ReadonlySet<string>;
  #version: () => number | undefined;
  #partsOnJoin: readonly string[];
  #subscribed = new Map<string, Set<string>>();

  constructor(
    options: PartSubscriptionsOptions<TCommand>
  ) {
    this.#parts = options.parts;
    this.#live = options.live;
    this.#members = options.members;
    this.#version = options.version;
    this.#partsOnJoin = options.partsOnJoin;
  }

  join(
    clientId: string,
    send: Send
  ): void {
    if (this.#partsOnJoin.length === 0) {
      return;
    }

    this.#subscribed.set(clientId, new Set(this.#partsOnJoin));
    send(this.#message(this.#partsOnJoin));
  }

  leave(
    clientId: string
  ): void {
    this.#subscribed.delete(clientId);
  }

  request(
    clientId: string,
    request: AssetPartsRequest,
    send: Send
  ): void {
    const subscribed = this.#subscribed.get(clientId) ?? new Set<string>();
    if (request.action !== ASSET_ROOM_SUBSCRIBE_PARTS) {
      for (const partId of request.parts) {
        subscribed.delete(partId);
      }

      return;
    }

    for (const partId of request.parts) {
      subscribed.add(partId);
    }
    this.#subscribed.set(clientId, subscribed);
    send(this.#message(request.parts));
  }

  resend(
    clientId: string,
    send: Send
  ): void {
    const subscribed = this.#subscribed.get(clientId);
    if (subscribed !== undefined && subscribed.size > 0) {
      send(this.#message(subscribed));
    }
  }

  resendAll(
    room: network.RoomBroadcast
  ): void {
    for (const clientId of this.#subscribed.keys()) {
      this.resend(clientId, (message) => room.sendTo(clientId, message));
    }
  }

  broadcast(
    room: network.RoomBroadcast,
    authorId: string,
    command: TCommand,
    message: unknown,
    version: number
  ): void {
    const touched = [...this.#parts.touched(command)];
    const outside = this.#live.outside?.(command) ?? null;
    for (const clientId of this.#members) {
      const subscribed = this.#subscribed.get(clientId);
      if (
        clientId === authorId ||
        touched.some((partId) => subscribed?.has(partId) === true)
      ) {
        room.sendTo(clientId, message);
      }
      else if (outside !== null) {
        room.sendTo(clientId, {
          type: "command",
          data: outside,
          version
        });
      }
    }
  }

  #message(
    partIds: Iterable<string>
  ): AssetRoomPartsMessage {
    const parts: Record<string, unknown> = {};
    for (const partId of partIds) {
      parts[partId] = this.#live.part(partId) ?? null;
    }

    return {
      type: ASSET_ROOM_PARTS,
      version: this.#version() ?? 0,
      parts
    };
  }
}
