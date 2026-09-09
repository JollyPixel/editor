// Import Internal Dependencies
import type { networkCommandHeaderSchema } from "./NetworkCommand.schema.ts";
import type { Infer } from "../protocol/schema.ts";

export type NetworkCommandHeader = Infer<typeof networkCommandHeaderSchema>;

export type NetworkServerMessage<Command, Snapshot> =
  | { type: "snapshot"; data: Snapshot; }
  | { type: "command"; data: Command; };
