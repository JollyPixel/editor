// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type {
  ClientHandle,
  PeerMetadata
} from "../../protocol/types.ts";

export interface RoomBroadcast {
  broadcast(
    payload: unknown
  ): void;
  sendTo(
    clientId: string,
    payload: unknown
  ): void;
}

/**
 * Omits `actor`; ServerRoom injects the member identity.
 */
export type RoomAppendInput = Omit<EventStore.AppendInput, "actor">;

export interface RoomEventStoreHandle {
  append(
    input: RoomAppendInput
  ): Promise<boolean>;

  list(
    assetId: string,
    fromVersion?: number
  ): Promise<EventStore.Event[]>;
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
  ): void | Promise<void>;

  abstract onClientDisconnect(
    clientId: string,
    context: RoomContext
  ): void | Promise<void>;

  abstract onMessage(
    clientId: string,
    payload: unknown,
    context: RoomContext
  ): void | Promise<void>;

  dispose?(): void | Promise<void>;
}

/**
 * Configures an extension hosted in a worker thread.
 */
export interface WorkerExtensionDescriptor {
  id: string;
  name: string;
  getEventName?: (payload: unknown) => string;
  modulePath: string | URL;
  exportName?: string;
  workerData?: unknown;
  rpcTimeoutMs?: number;
  maxRestarts?: number;
  restartWindowMs?: number;
}
