// Import Internal Dependencies
import type {
  ClientHandle,
  PeerMetadata
} from "../types.ts";

export interface RoomHandle {
  broadcast(
    payload: unknown
  ): void;
}

export abstract class RoomAuthority {
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
    room: RoomHandle
  ): void;

  abstract onClientDisconnect(
    clientId: string,
    room: RoomHandle
  ): void;

  abstract onMessage(
    clientId: string,
    payload: unknown,
    room: RoomHandle
  ): void;
}
