export interface ClientHandle {
  readonly id: string;
  send(data: unknown): void;
}

/**
 * Minimal, transport-agnostic logging surface.
 */
export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export type PeerMetadata = Record<string, unknown>;

export interface Peer {
  readonly clientId: string;
  readonly identity: PeerMetadata;
  readonly presence: PeerMetadata;
}
