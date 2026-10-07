// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type {
  ANIMATION_CHANNELS,
  ANIMATION_INTERPOLATIONS,
  ANIMATION_LOOPS,
  animationClipPatchSchema,
  animationClipSchema,
  animationCommandSchema,
  animationKeySchema,
  animationSetSnapshotSchema,
  animationTrackSchema,
  vector3Schema
} from "./AnimationCommand.schema.ts";

export type Vector3JSON = network.Infer<typeof vector3Schema>;
export type AnimationChannel = typeof ANIMATION_CHANNELS[number];
export type AnimationInterpolation = typeof ANIMATION_INTERPOLATIONS[number];
export type AnimationLoop = typeof ANIMATION_LOOPS[number];
export type AnimationKeyJSON = network.Infer<typeof animationKeySchema>;
export type AnimationTrackJSON = network.Infer<typeof animationTrackSchema>;
export type AnimationClipJSON = network.Infer<typeof animationClipSchema>;
export type AnimationClipPatchJSON = network.Infer<typeof animationClipPatchSchema>;
export type AnimationSetSnapshot = network.Infer<typeof animationSetSnapshotSchema>;

export type AnimationCommand = network.Infer<typeof animationCommandSchema>;
export type AnimationCommandAction = AnimationCommand["action"];
export type AnimationNetworkCommand = AnimationCommand & network.NetworkCommandHeader;

export type AnimationServerMessage = network.NetworkServerMessage<
  AnimationNetworkCommand,
  AnimationSetSnapshot,
  AssetRoomNotice
>;

export type AnimationRoom = network.Room<
  AnimationNetworkCommand,
  AnimationServerMessage
>;
