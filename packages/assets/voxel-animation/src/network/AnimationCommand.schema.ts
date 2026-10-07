// Import Third-party Dependencies
import {
  commandVariant,
  defineSchema,
  MessageProtocol,
  withCommandHeader
} from "@jolly-pixel/network";

// CONSTANTS
export const ANIMATION_CHANNELS = ["position", "rotation", "scale"] as const;
export const ANIMATION_INTERPOLATIONS = ["step", "linear", "smooth"] as const;
export const ANIMATION_LOOPS = ["loop", "once"] as const;

export const vector3Schema = defineSchema({
  type: "object",
  properties: {
    x: { type: "number" },
    y: { type: "number" },
    z: { type: "number" }
  },
  required: ["x", "y", "z"]
});

export const animationChannelSchema = defineSchema({
  enum: ANIMATION_CHANNELS
});

export const animationKeySchema = defineSchema({
  type: "object",
  properties: {
    tick: { type: "integer", minimum: 0 },
    value: vector3Schema,
    interpolation: { enum: ANIMATION_INTERPOLATIONS }
  },
  required: ["tick", "value", "interpolation"]
});

const kKeysSchema = defineSchema({
  type: "array",
  items: animationKeySchema
});

export const animationTrackSchema = defineSchema({
  type: "object",
  properties: {
    path: { type: "string", minLength: 1 },
    position: kKeysSchema,
    rotation: kKeysSchema,
    scale: kKeysSchema
  },
  required: ["path"]
});

export const animationClipSchema = defineSchema({
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    length: { type: "integer", minimum: 1 },
    fps: { type: "integer", minimum: 1 },
    loop: { enum: ANIMATION_LOOPS },
    tracks: { type: "array", items: animationTrackSchema }
  },
  required: ["id", "name", "length", "fps", "loop", "tracks"]
});

export const animationClipPatchSchema = defineSchema({
  type: "object",
  properties: {
    name: { type: "string" },
    length: { type: "integer", minimum: 1 },
    fps: { type: "integer", minimum: 1 },
    loop: { enum: ANIMATION_LOOPS }
  },
  additionalProperties: false
});

export const animationSetSnapshotSchema = defineSchema({
  type: "object",
  properties: {
    rig: { type: "string" },
    clips: { type: "array", items: animationClipSchema }
  },
  required: ["rig", "clips"]
});

export const animationCommandSchema = defineSchema({
  oneOf: [
    commandVariant("rig-renamed", {
      rig: { type: "string" }
    }),
    commandVariant("clip-added", {
      clip: animationClipSchema
    }, {
      beforeId: { type: "string" }
    }),
    commandVariant("clip-removed", {
      id: { type: "string" }
    }),
    commandVariant("clip-changed", {
      id: { type: "string" },
      patch: animationClipPatchSchema
    }),
    commandVariant("clip-moved", {
      id: { type: "string" }
    }, {
      beforeId: { type: "string" }
    }),
    commandVariant("key-set", {
      clipId: { type: "string" },
      path: { type: "string", minLength: 1 },
      channel: animationChannelSchema,
      key: animationKeySchema
    }),
    commandVariant("key-removed", {
      clipId: { type: "string" },
      path: { type: "string" },
      channel: animationChannelSchema,
      tick: { type: "integer", minimum: 0 }
    }),
    commandVariant("track-removed", {
      clipId: { type: "string" },
      path: { type: "string" }
    }),
    commandVariant("track-renamed", {
      clipId: { type: "string" },
      path: { type: "string" },
      to: { type: "string", minLength: 1 }
    })
  ]
});

export const animationCommandProtocol: MessageProtocol = new MessageProtocol({
  oneOf: animationCommandSchema.oneOf.map(withCommandHeader)
});
