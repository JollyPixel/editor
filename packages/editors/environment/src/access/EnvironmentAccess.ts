// Import Third-party Dependencies
import {
  ENVIRONMENT_CAPABILITIES,
  type EnvironmentCommand
} from "@jolly-pixel/asset.environment/client";
import {
  CapabilityTable,
  type CapabilityName,
  type RoomGrants
} from "@jolly-pixel/network/client";

export type EnvironmentCapability = CapabilityName<typeof ENVIRONMENT_CAPABILITIES>;
export type EnvironmentGrants = RoomGrants<
  EnvironmentCommand["action"],
  EnvironmentCapability
>;
export type EnvironmentAccessSource = Pick<EnvironmentGrants, "current" | "subscribe">;

export const ENVIRONMENT_CAPABILITY_TABLE = new CapabilityTable(
  ENVIRONMENT_CAPABILITIES
);
