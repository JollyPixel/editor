// Import Third-party Dependencies
import {
  SOUND_CAPABILITIES,
  type SoundCommand
} from "@jolly-pixel/asset.sound/client";
import {
  CapabilityTable,
  type CapabilityName,
  type RoomGrants
} from "@jolly-pixel/network/client";

export type SoundCapability = CapabilityName<typeof SOUND_CAPABILITIES>;
export type SoundGrants = RoomGrants<SoundCommand["action"], SoundCapability>;
export type SoundAccessSource = Pick<SoundGrants, "current" | "subscribe">;

export const SOUND_CAPABILITY_TABLE = new CapabilityTable(SOUND_CAPABILITIES);
