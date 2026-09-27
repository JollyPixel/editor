export type ClientSocketEventType = "open" | "message" | "error" | "close";

export interface ClientSocketEvent {
  readonly data?: unknown;
  readonly code?: number;
  readonly reason?: string;
}

/**
 * The part of a `WebSocket` the client relies on.
 */
export interface ClientSocket {
  send(
    data: string
  ): void;

  close(): void;

  addEventListener(
    type: ClientSocketEventType,
    listener: (event: ClientSocketEvent) => void
  ): void;
}
