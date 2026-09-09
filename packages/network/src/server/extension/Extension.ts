// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type { MessageProtocols } from "../../protocol/MessageProtocol.ts";
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

export abstract class Extension<
  TMessage = unknown
> {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly protocols: MessageProtocols;

  onClientConnect?(
    client: ClientHandle,
    identity: PeerMetadata,
    context: RoomContext
  ): void | Promise<void>;

  onClientDisconnect?(
    clientId: string,
    context: RoomContext
  ): void | Promise<void>;

  onMessage?(
    clientId: string,
    message: TMessage,
    context: RoomContext
  ): void | Promise<void>;

  dispose?(): void | Promise<void>;
}

export type AnyExtension = Extension<unknown>;

/**
 * Configures an extension hosted in a worker thread.
 */
export interface WorkerExtensionDescriptor {
  id: string;
  name: string;
  protocols: MessageProtocols;
  modulePath: string | URL;
  exportName?: string;
  workerData?: unknown;
  rpcTimeoutMs?: number;
  maxRestarts?: number;
  restartWindowMs?: number;
}
