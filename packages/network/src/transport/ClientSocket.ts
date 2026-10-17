export type ClientSocketEventType = "open" | "message" | "error" | "close";

export interface ClientSocketEvent {
  readonly data?: unknown;
  readonly code?: number;
  readonly reason?: string;
}

export type ClientSocketListener = (event: ClientSocketEvent) => void;

export interface SocketConnectOptions {
  /**
   * Opaque credential handed to the server's authentication provider.
   */
  credential?: string;
}

export interface ClientSocket {
  send(
    data: string
  ): void;

  close(): void;

  addEventListener(
    type: ClientSocketEventType,
    listener: ClientSocketListener
  ): void;
}
