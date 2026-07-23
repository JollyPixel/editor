export type NetworkChannelMessageListener<ServerPayload = unknown> = (
  payload: ServerPayload
) => void;

export type NetworkChannelPeerListener = (
  clientId: string
) => void;

export interface NetworkChannel<
  ClientPayload = unknown,
  ServerPayload = unknown
> {
  readonly namespace: string;
  readonly localClientId: string;

  send(
    payload: ClientPayload
  ): void;
  leave(): void;

  onMessage: NetworkChannelMessageListener<ServerPayload> | null;
  /**
   * Called when another client joins this namespace, after the local channel itself has joined.
   * Never fires for the local client's own join.
   */
  onPeerJoined: NetworkChannelPeerListener | null;
  /**
   * Called when another client that had joined this namespace leaves or disconnects.
   */
  onPeerLeft: NetworkChannelPeerListener | null;
}
