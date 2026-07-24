// Import Internal Dependencies
import type {
  ClientHandle,
  PeerMetadata
} from "./types.ts";

export abstract class NetworkPlugin {
  abstract readonly namespace: string;

  abstract onClientConnect(
    client: ClientHandle,
    identity: PeerMetadata
  ): void;

  abstract onClientDisconnect(
    clientId: string
  ): void;

  abstract onMessage(
    clientId: string,
    payload: unknown
  ): void;

  attach?(
    broadcast: (payload: unknown) => void
  ): void;
}
