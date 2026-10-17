// Import Third-party Dependencies
import {
  commandVariant,
  MessageProtocol,
  withCommandHeader
} from "@jolly-pixel/network";
import * as z from "zod/mini";

// CONSTANTS
export const ANIMATION_CHANNELS = ["position", "rotation", "scale"] as const;
export const ANIMATION_INTERPOLATIONS = ["step", "linear", "smooth"] as const;

export const vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

export const animationChannelSchema = z.enum(ANIMATION_CHANNELS);

const kTick = z.int().check(z.minimum(0));
const kPositiveInteger = z.int().check(z.minimum(1));

export const animationKeySchema = z.object({
  tick: kTick,
  value: vector3Schema,
  interpolation: z.enum(ANIMATION_INTERPOLATIONS)
});

const kKeysSchema = z.optional(z.array(animationKeySchema));

export const animationTrackSchema = z.object({
  path: z.string().check(z.minLength(1)),
  position: kKeysSchema,
  rotation: kKeysSchema,
  scale: kKeysSchema
});

export const animationClipSchema = z.object({
  id: z.string(),
  name: z.string(),
  length: kPositiveInteger,
  fps: kPositiveInteger,
  loop: z.boolean(),
  tracks: z.array(animationTrackSchema)
});

export const animationClipPatchSchema = z.strictObject({
  name: z.optional(z.string()),
  length: z.optional(kPositiveInteger),
  fps: z.optional(kPositiveInteger),
  loop: z.optional(z.boolean())
});

export const animationSetSnapshotSchema = z.object({
  rig: z.string(),
  clips: z.array(animationClipSchema)
});

export const animationCommandSchema = z.discriminatedUnion("action", [
  commandVariant("rig-renamed", {
    rig: z.string()
  }),
  commandVariant("clip-added", {
    clip: animationClipSchema,
    beforeId: z.optional(z.string())
  }),
  commandVariant("clip-removed", {
    id: z.string()
  }),
  commandVariant("clip-changed", {
    id: z.string(),
    patch: animationClipPatchSchema
  }),
  commandVariant("clip-moved", {
    id: z.string(),
    beforeId: z.optional(z.string())
  }),
  commandVariant("key-set", {
    clipId: z.string(),
    path: z.string().check(z.minLength(1)),
    channel: animationChannelSchema,
    key: animationKeySchema
  }),
  commandVariant("key-removed", {
    clipId: z.string(),
    path: z.string(),
    channel: animationChannelSchema,
    tick: kTick
  }),
  commandVariant("track-removed", {
    clipId: z.string(),
    path: z.string()
  }),
  commandVariant("track-renamed", {
    clipId: z.string(),
    path: z.string(),
    to: z.string().check(z.minLength(1))
  })
]);

export const animationCommandProtocol: MessageProtocol = new MessageProtocol(
  z.union(animationCommandSchema.def.options.map(withCommandHeader))
);
