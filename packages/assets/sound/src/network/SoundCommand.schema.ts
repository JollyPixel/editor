// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/ecs";
import {
  bytesSchema,
  commandVariant,
  MessageProtocol,
  minProperties,
  withCommandHeader
} from "@jolly-pixel/network";
import * as z from "zod/mini";

// CONSTANTS
const kDistanceSchema = z.number().check(z.minimum(0));
const kLimits = Systems.SOUND_SETTINGS_LIMITS;

const kSettingsShape = {
  category: z.string().check(z.minLength(1), z.maxLength(64)),
  volume: z.number().check(z.minimum(0), z.maximum(1)),
  loop: z.boolean(),
  loopStart: kDistanceSchema,
  loopEnd: kDistanceSchema,
  pitch: z.number().check(
    z.minimum(kLimits.minPitch),
    z.maximum(kLimits.maxPitch)
  ),
  pitchVariation: z.number().check(
    z.minimum(0),
    z.maximum(kLimits.maxPitchVariation)
  ),
  cooldown: kDistanceSchema,
  maxInstances: z.int().check(z.minimum(0)),
  spatial: z.strictObject({
    refDistance: kDistanceSchema,
    maxDistance: kDistanceSchema,
    rolloffFactor: kDistanceSchema,
    distanceModel: z.enum(Systems.SOUND_DISTANCE_MODELS)
  })
};

export const soundSnapshotSchema = bytesSchema;

export const soundCommandSchema = commandVariant("sound-settings-changed", {
  set: minProperties(z.partial(z.strictObject(kSettingsShape)), 1)
});

export const soundCommandProtocol: MessageProtocol = new MessageProtocol(
  withCommandHeader(soundCommandSchema)
);
