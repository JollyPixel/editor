// Import Third-party Dependencies
import {
  SCRIPT_CAPABILITIES,
  type ScriptCommand
} from "@jolly-pixel/asset.script/client";
import {
  CapabilityTable,
  type CapabilityName,
  type Grants,
  type RoomGrants
} from "@jolly-pixel/network/client";

export type ScriptCapability = CapabilityName<typeof SCRIPT_CAPABILITIES>;
export type ScriptGrants = RoomGrants<ScriptCommand["action"], ScriptCapability>;
export type ScriptAccessSource = Pick<ScriptGrants, "current" | "subscribe">;

export const SCRIPT_CAPABILITY_TABLE = new CapabilityTable(SCRIPT_CAPABILITIES);

export function canEditText(
  grants: Grants<ScriptCapability>
): boolean {
  return grants.has("text");
}
