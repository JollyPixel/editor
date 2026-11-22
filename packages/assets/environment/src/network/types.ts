// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { Systems } from "@jolly-pixel/ecs";

export type EnvironmentFile = Systems.EnvironmentFile;
export type EnvironmentPresetName = Systems.EnvironmentPresetName;
export type EnvironmentSection = Exclude<keyof EnvironmentFile, "version">;
export type EnvironmentChange = Partial<Pick<EnvironmentFile, EnvironmentSection>>;

export interface EnvironmentCommand {
  action: "environment-changed";
  set: EnvironmentChange;
}

export type EnvironmentNetworkCommand = EnvironmentCommand & network.NetworkCommandHeader;
