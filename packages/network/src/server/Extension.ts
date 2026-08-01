// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type {
  ClientHandle,
  PeerMetadata
} from "../types.ts";

export interface RoomBroadcast {
  broadcast(
    payload: unknown
  ): void;
}

export interface RoomEventStoreHandle {
  append(
    input: EventStore.AppendInput
  ): boolean;

  list(
    assetId: string,
    fromVersion?: number
  ): EventStore.Event[];
}

export interface RoomContext {
  readonly room: RoomBroadcast;
  readonly eventStore: RoomEventStoreHandle;
}

export abstract class Extension {
  abstract readonly id: string;
  abstract readonly name: string;

  readonly events: readonly string[] = [];

  getEventName(
    _payload: unknown
  ): string {
    throw new Error(
      `${this.constructor.name}: getEventName() must be implemented to use a configured rights table`
    );
  }

  abstract onClientConnect(
    client: ClientHandle,
    identity: PeerMetadata,
    context: RoomContext
  ): void;

  abstract onClientDisconnect(
    clientId: string,
    context: RoomContext
  ): void;

  abstract onMessage(
    clientId: string,
    payload: unknown,
    context: RoomContext
  ): void;
}
