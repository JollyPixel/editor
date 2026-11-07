// Import Internal Dependencies
import type { MessageProtocols } from "../../protocol/message/MessageProtocol.ts";
import type { PeerMetadata } from "../../protocol/types.ts";
import type {
  ClientHandle,
  SendOptions
} from "./ClientHandle.ts";
import type { PeerIdentity } from "../auth/AuthenticationProvider.ts";

export interface RoomPeer {
  readonly clientId: string;
  readonly identity: PeerIdentity;
  readonly profile: PeerMetadata;
  readonly presence: PeerMetadata;
  readonly resume?: unknown;
}

export interface RoomBroadcast {
  broadcast(
    payload: unknown,
    options?: SendOptions
  ): void;
  sendTo(
    clientId: string,
    payload: unknown,
    options?: SendOptions
  ): void;
}

export interface RoomContext {
  readonly room: RoomBroadcast;
  readonly identity: PeerIdentity;
}

export abstract class Extension<
  TMessage = unknown
> {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly protocols: MessageProtocols;
  readonly queries?: readonly string[];

  onClientConnect?(
    client: ClientHandle,
    peer: RoomPeer,
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

  onResync?(
    clientId: string,
    context: RoomContext
  ): void | Promise<void>;

  dispose?(): void | Promise<void>;
}

export type AnyExtension = Extension<unknown>;
