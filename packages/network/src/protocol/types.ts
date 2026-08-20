export interface ClientHandle {
  readonly id: string;
  send(data: unknown): void;
}

export type PeerMetadata = Record<string, unknown>;

export interface Peer {
  readonly clientId: string;
  readonly identity: PeerMetadata;
  readonly presence: PeerMetadata;
}
