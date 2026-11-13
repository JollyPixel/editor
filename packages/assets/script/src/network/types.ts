// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type {
  scriptCommandSchema,
  scriptSnapshotSchema,
  ScriptOutlineMessage
} from "./ScriptCommand.schema.ts";

export type ScriptCommand = network.Infer<typeof scriptCommandSchema>;

export interface ScriptStep {
  readonly command: ScriptCommand;
}
export type ScriptNetworkCommand = ScriptCommand & network.NetworkCommandHeader;
export type ScriptSnapshot = network.Infer<typeof scriptSnapshotSchema>;
export type ScriptNotice = AssetRoomNotice | ScriptOutlineMessage;

export type ScriptServerMessage = network.NetworkServerMessage<
  ScriptNetworkCommand,
  ScriptSnapshot,
  ScriptNotice
>;

export type ScriptRoom = network.Room<
  ScriptNetworkCommand,
  ScriptServerMessage
>;
