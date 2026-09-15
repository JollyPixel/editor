// Import Internal Dependencies
import type { networkCommandHeaderSchema } from "./NetworkCommand.schema.ts";
import type { Infer } from "../protocol/schema.ts";

export type NetworkCommandHeader = Infer<typeof networkCommandHeaderSchema>;

export interface NetworkServerNotice {
  type: string;
}

export type NetworkServerMessage<
  TCommand,
  TSnapshot,
  TNotice extends NetworkServerNotice = never
> =
  | { type: "snapshot"; data: TSnapshot; }
  | { type: "command"; data: TCommand; }
  | TNotice;
