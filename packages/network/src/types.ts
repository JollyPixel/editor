export interface ClientHandle {
  readonly id: string;
  send(data: unknown): void;
}

export interface NetworkCommandHeader {
  clientId: string;
  seq: number;
  timestamp: number;
}

export type NetworkServerMessage<Command, Snapshot> =
  | { type: "snapshot"; data: Snapshot; }
  | { type: "command"; data: Command; };

export type PeerMetadata = Record<string, unknown>;

export interface Peer {
  readonly clientId: string;
  readonly identity: PeerMetadata;
  readonly presence: PeerMetadata;
}
