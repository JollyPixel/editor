// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { Systems } from "@jolly-pixel/engine/core";

export type SoundSettings = Systems.SoundSettings;
export type SoundSettingsChange = Partial<SoundSettings>;

export interface SoundCommand {
  action: "sound-settings-changed";
  set: SoundSettingsChange;
}

export type SoundNetworkCommand = SoundCommand & network.NetworkCommandHeader;
