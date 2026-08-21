export interface NetworkCommandHeader {
  clientId: string;
  seq: number;
  timestamp: number;
}

export type NetworkServerMessage<Command, Snapshot> =
  | { type: "snapshot"; data: Snapshot; }
  | { type: "command"; data: Command; };
