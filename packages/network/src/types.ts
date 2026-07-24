export interface ClientHandle {
  readonly id: string;
  send(data: unknown): void;
}

export type PeerMetadata = Record<string, unknown>;

export interface PeerInfo {
  clientId: string;
  identity: PeerMetadata;
  presence: PeerMetadata;
}

export type NetworkEnvelope =
  | { namespace: string; kind: "join"; identity?: PeerMetadata; }
  | { namespace: string; kind: "leave"; }
  | { namespace: string; kind: "message"; payload: unknown; }
  | { namespace: string; kind: "presence"; patch: PeerMetadata; }
  | { namespace: string; kind: "sync"; members: PeerInfo[]; }
  | { namespace: string; kind: "peer-joined"; clientId: string; identity: PeerMetadata; }
  | { namespace: string; kind: "peer-left"; clientId: string; }
  | { namespace: string; kind: "peer-presence"; clientId: string; patch: PeerMetadata; };
