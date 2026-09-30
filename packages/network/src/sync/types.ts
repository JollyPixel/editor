// Import Internal Dependencies
import type { networkCommandHeaderSchema } from "./NetworkCommand.schema.ts";
import type { Infer } from "../protocol/schema.ts";

export type NetworkCommandHeader = Infer<typeof networkCommandHeaderSchema>;

export type NetworkAcks = Record<string, number>;

export interface NetworkResume {
  clientId: string;
  version?: number;
}

export interface NetworkServerNotice {
  type: string;
}

type NetworkSyncMessageType =
  | "snapshot"
  | "command"
  | "correction"
  | "catch-up";

export type NetworkServerNoticeOf<TNotice extends NetworkServerNotice> =
  [Extract<NetworkSyncMessageType, TNotice["type"]>] extends [never] ?
    NetworkServerNotice :
    never;

export type NetworkSyncMessage<TCommand, TSnapshot> =
  | { type: "snapshot"; data: TSnapshot; version?: number; acks?: NetworkAcks; }
  | { type: "command"; data: TCommand; version?: number; }
  | { type: "correction"; data: TCommand; acks?: NetworkAcks; }
  | { type: "catch-up"; data: TCommand[]; version: number; acks?: NetworkAcks; };

export type NetworkServerMessage<
  TCommand,
  TSnapshot,
  TNotice extends NetworkServerNoticeOf<TNotice> = never
> =
  | NetworkSyncMessage<TCommand, TSnapshot>
  | TNotice;
