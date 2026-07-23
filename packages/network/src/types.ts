export interface ClientHandle {
  readonly id: string;
  send(data: unknown): void;
}

/**
 * Wire-level envelope multiplexing multiple NetworkPlugin namespaces over a
 * single transport connection.
 */
export type NetworkEnvelope =
  | { namespace: string; kind: "join"; }
  | { namespace: string; kind: "leave"; }
  | { namespace: string; kind: "message"; payload: unknown; }
  | { namespace: string; kind: "peer-joined"; clientId: string; }
  | { namespace: string; kind: "peer-left"; clientId: string; };
