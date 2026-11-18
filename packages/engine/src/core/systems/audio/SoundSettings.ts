// Import Internal Dependencies
import { MathUtils } from "../../math.ts";
import {
  ComponentData,
  isJSONObject
} from "../scene/file/definitions/ComponentData.ts";
import type { JSONObject } from "../scene/file/SceneFile.ts";
import type { OggHeader } from "./OggHeader.ts";

export type SoundDistanceModel = keyof typeof SOUND_DISTANCE_MODELS;
export type BuiltInSoundCategory = typeof SOUND_CATEGORIES[number];

export interface SoundSpatialSettings {
  /**
   * Distance in world units under which the volume is not reduced.
   * @default 1
   */
  refDistance: number;
  /**
   * Distance in world units past which the volume stops decreasing. Only
   * the "linear" model reads it.
   * @default 100
   */
  maxDistance: number;
  /**
   * How fast the volume drops past the reference distance.
   * @default 1
   */
  rolloffFactor: number;
  /**
   * @default "inverse"
   */
  distanceModel: SoundDistanceModel;
}

export interface SoundSettings {
  /**
   * Mixer category the sound plays through, such as "music" or "sfx".
   * @default "sfx"
   */
  category: string;
  /**
   * In [0, 1].
   * @default 1
   */
  volume: number;
  /**
   * @default false
   */
  loop: boolean;
  /**
   * Start of the looped region in seconds.
   * @default 0
   */
  loopStart: number;
  /**
   * End of the looped region in seconds; 0 loops up to the end.
   * @default 0
   */
  loopEnd: number;
  /**
   * Playback rate; 2 plays one octave higher and twice as fast.
   * @default 1
   */
  pitch: number;
  /**
   * Random share added to or removed from the pitch on each play, in [0, 0.9].
   * @default 0
   */
  pitchVariation: number;
  /**
   * Seconds during which a new play of the same sound is refused.
   * @default 0
   */
  cooldown: number;
  /**
   * Plays of the same sound heard at once; the oldest stops when a new one
   * starts. 0 means no limit.
   * @default 0
   */
  maxInstances: number;
  spatial: SoundSpatialSettings;
}

export type SoundSettingsInput = Partial<Omit<SoundSettings, "spatial">> & {
  spatial?: Partial<SoundSpatialSettings>;
};

// CONSTANTS
export const SOUND_SETTINGS_TAG = "JOLLYPIXEL_SOUND";

export const SOUND_SPATIAL_DEFAULTS = Object.freeze({
  refDistance: 1,
  maxDistance: 100,
  rolloffFactor: 1,
  distanceModel: "inverse"
} as const satisfies SoundSpatialSettings);

export const SOUND_SETTINGS_DEFAULTS: Readonly<SoundSettings> = Object.freeze({
  category: "sfx",
  volume: 1,
  loop: false,
  loopStart: 0,
  loopEnd: 0,
  pitch: 1,
  pitchVariation: 0,
  cooldown: 0,
  maxInstances: 0,
  spatial: SOUND_SPATIAL_DEFAULTS
});

export const SOUND_DISTANCE_MODELS = Object.freeze({
  inverse: "inverse",
  linear: "linear",
  exponential: "exponential"
} as const);

export const SOUND_CATEGORIES = [
  "music",
  "sfx",
  "ui",
  "ambient",
  "voice"
] as const;

export const SOUND_SETTINGS_LIMITS = Object.freeze({
  minPitch: 0.01,
  maxPitch: 16,
  maxPitchVariation: 0.9
});

export function rollPitch(): number {
  return Math.random() * 2 - 1;
}

export function variedPitch(
  settings: Readonly<SoundSettings>,
  roll = rollPitch()
): number {
  return settings.pitch * (1 + roll * settings.pitchVariation);
}

export function mergeSoundSettings(
  base: Readonly<SoundSettings>,
  overrides: SoundSettingsInput
): SoundSettings {
  const merged = {
    ...base,
    ...withoutUndefined(overrides),
    spatial: {
      ...base.spatial,
      ...withoutUndefined(overrides.spatial ?? {})
    }
  };

  return {
    category: merged.category === "" ? base.category : merged.category,
    volume: MathUtils.clamp(merged.volume, 0, 1),
    loop: merged.loop,
    loopStart: Math.max(merged.loopStart, 0),
    loopEnd: Math.max(merged.loopEnd, 0),
    pitch: MathUtils.clamp(
      merged.pitch,
      SOUND_SETTINGS_LIMITS.minPitch,
      SOUND_SETTINGS_LIMITS.maxPitch
    ),
    pitchVariation: MathUtils.clamp(
      merged.pitchVariation,
      0,
      SOUND_SETTINGS_LIMITS.maxPitchVariation
    ),
    cooldown: Math.max(merged.cooldown, 0),
    maxInstances: Math.max(Math.floor(merged.maxInstances), 0),
    spatial: {
      refDistance: Math.max(merged.spatial.refDistance, 0),
      maxDistance: Math.max(merged.spatial.maxDistance, 0),
      rolloffFactor: Math.max(merged.spatial.rolloffFactor, 0),
      distanceModel: merged.spatial.distanceModel
    }
  };
}

export function parseSoundSettings(
  data: Readonly<JSONObject>
): SoundSettings {
  const fields = new ComponentData(data);
  const defaults = SOUND_SETTINGS_DEFAULTS;
  const spatial = fields.object("spatial") ?? new ComponentData({});
  const spatialDefaults = SOUND_SPATIAL_DEFAULTS;

  return mergeSoundSettings(defaults, {
    category: fields.string("category", defaults.category),
    volume: fields.number("volume", defaults.volume),
    loop: fields.boolean("loop", defaults.loop),
    loopStart: fields.number("loopStart", defaults.loopStart),
    loopEnd: fields.number("loopEnd", defaults.loopEnd),
    pitch: fields.number("pitch", defaults.pitch),
    pitchVariation: fields.number("pitchVariation", defaults.pitchVariation),
    cooldown: fields.number("cooldown", defaults.cooldown),
    maxInstances: fields.number("maxInstances", defaults.maxInstances),
    spatial: {
      refDistance: spatial.number("refDistance", spatialDefaults.refDistance),
      maxDistance: spatial.number("maxDistance", spatialDefaults.maxDistance),
      rolloffFactor: spatial.number(
        "rolloffFactor",
        spatialDefaults.rolloffFactor
      ),
      distanceModel: spatial.choice(
        "distanceModel",
        SOUND_DISTANCE_MODELS,
        spatialDefaults.distanceModel
      )
    }
  });
}

export function readSoundSettings(
  header: OggHeader | null
): SoundSettings {
  const tag = header?.comment(SOUND_SETTINGS_TAG);
  if (tag === undefined) {
    return SOUND_SETTINGS_DEFAULTS;
  }

  try {
    const data: unknown = JSON.parse(tag);

    return isJSONObject(data) ?
      parseSoundSettings(data) :
      SOUND_SETTINGS_DEFAULTS;
  }
  catch {
    return SOUND_SETTINGS_DEFAULTS;
  }
}

export function writeSoundSettings(
  header: OggHeader,
  settings: Readonly<SoundSettings>
): Uint8Array {
  return header.withComment(SOUND_SETTINGS_TAG, JSON.stringify(settings));
}

function withoutUndefined<T extends object>(
  value: T
): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>;
}
