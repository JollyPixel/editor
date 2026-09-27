// Import Internal Dependencies
import type { networkCommandHeaderSchema } from "./NetworkCommand.schema.ts";
import type { Infer } from "../protocol/schema.ts";

export type NetworkCommandHeader = Infer<typeof networkCommandHeaderSchema>;

export interface NetworkServerNotice {
  type: string;
}

type NetworkSyncMessageType = "snapshot" | "command";

export type NetworkServerNoticeOf<TNotice extends NetworkServerNotice> =
  [Extract<NetworkSyncMessageType, TNotice["type"]>] extends [never] ?
    NetworkServerNotice :
    never;

export type NetworkServerMessage<
  TCommand,
  TSnapshot,
  TNotice extends NetworkServerNoticeOf<TNotice> = never
> =
  | { type: "snapshot"; data: TSnapshot; }
  | { type: "command"; data: TCommand; }
  | TNotice;
