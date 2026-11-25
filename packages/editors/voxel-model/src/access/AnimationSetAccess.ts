// Import Third-party Dependencies
import {
  VOXEL_ANIMATION_CAPABILITIES,
  type AnimationCommandAction
} from "@jolly-pixel/asset.voxel-animation/client";
import {
  CapabilityTable,
  type CapabilityName,
  type RoomGrants
} from "@jolly-pixel/network/client";

export type AnimationSetCapability = CapabilityName<
  typeof VOXEL_ANIMATION_CAPABILITIES
>;
export type AnimationSetGrants = RoomGrants<
  AnimationCommandAction,
  AnimationSetCapability
>;
export type AnimationSetGrantsSource = Pick<
  AnimationSetGrants,
  "current" | "subscribe"
>;

export const ANIMATION_SET_CAPABILITY_TABLE = new CapabilityTable(
  VOXEL_ANIMATION_CAPABILITIES
);
