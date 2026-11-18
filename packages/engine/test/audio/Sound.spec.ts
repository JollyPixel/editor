// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  parseSoundSettings,
  SOUND_SETTINGS_DEFAULTS
} from "../../src/core/systems/audio/SoundSettings.ts";
import { Sound } from "../../src/three/audio/Sound.ts";
import { fakeAudioBuffer } from "../helpers/audio/FakeAudioContext.ts";

describe("Audio.Sound", () => {
  test("should keep its settings within their valid range", () => {
    const sound = new Sound(fakeAudioBuffer(), {
      category: "",
      volume: 4,
      pitch: -1,
      pitchVariation: 3,
      cooldown: -2,
      maxInstances: 2.7,
      spatial: {
        maxDistance: -5
      }
    });

    assert.deepStrictEqual(sound.settings, {
      ...SOUND_SETTINGS_DEFAULTS,
      volume: 1,
      pitch: 0.01,
      pitchVariation: 0.9,
      maxInstances: 2,
      spatial: {
        ...SOUND_SETTINGS_DEFAULTS.spatial,
        maxDistance: 0
      }
    });
  });

  test("should parse stored settings, keeping defaults for missing or invalid fields", () => {
    const settings = parseSoundSettings({
      category: "music",
      volume: "loud",
      loop: true,
      spatial: {
        refDistance: 3,
        distanceModel: "cubic"
      }
    });

    assert.deepStrictEqual(settings, {
      ...SOUND_SETTINGS_DEFAULTS,
      category: "music",
      loop: true,
      spatial: {
        ...SOUND_SETTINGS_DEFAULTS.spatial,
        refDistance: 3
      }
    });
  });
});
