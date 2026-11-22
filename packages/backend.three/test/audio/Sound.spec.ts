// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { Sound } from "../../src/audio/Sound.ts";
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
      ...Systems.SOUND_SETTINGS_DEFAULTS,
      volume: 1,
      pitch: 0.01,
      pitchVariation: 0.9,
      maxInstances: 2,
      spatial: {
        ...Systems.SOUND_SETTINGS_DEFAULTS.spatial,
        maxDistance: 0
      }
    });
  });

  test("should parse stored settings, keeping defaults for missing or invalid fields", () => {
    const settings = Systems.parseSoundSettings({
      category: "music",
      volume: "loud",
      loop: true,
      spatial: {
        refDistance: 3,
        distanceModel: "cubic"
      }
    });

    assert.deepStrictEqual(settings, {
      ...Systems.SOUND_SETTINGS_DEFAULTS,
      category: "music",
      loop: true,
      spatial: {
        ...Systems.SOUND_SETTINGS_DEFAULTS.spatial,
        refDistance: 3
      }
    });
  });
});
