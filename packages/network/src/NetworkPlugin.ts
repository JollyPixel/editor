// Import Internal Dependencies
import type { ClientHandle } from "./types.ts";

export abstract class NetworkPlugin {
  abstract readonly namespace: string;

  abstract onClientConnect(
    client: ClientHandle
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
