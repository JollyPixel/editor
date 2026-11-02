// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Preferences } from "@jolly-pixel/preferences";

// Import Internal Dependencies
import { SoundPlayer } from "#src/player/SoundPlayer.ts";
import { Volume } from "#src/player/volume/Volume.ts";
import { VolumePreference } from "#src/player/volume/VolumePreference.ts";
import { SOUND_PREFERENCES } from "#src/preferences.ts";
import { FakeAudioContext } from "../helpers/FakeAudioContext.ts";

function followingPreferences(
  preferences: Preferences
): SoundPlayer {
  const player = new SoundPlayer(new FakeAudioContext().asAudioContext());
  new VolumePreference(preferences).follow(player);

  return player;
}

describe("VolumePreference", () => {
  test("starts at half volume when nothing is saved", () => {
    const player = followingPreferences(new Preferences());

    assert.equal(player.volume.level, 0.5);
  });

  test("restores the volume another player saved", () => {
    const preferences = new Preferences();
    const first = followingPreferences(preferences);
    first.volume = new Volume(0.3);

    const second = followingPreferences(preferences);

    assert.equal(second.volume.level, 0.3);
  });

  test("applies a volume changed from the settings while playing", () => {
    const preferences = new Preferences();
    const player = followingPreferences(preferences);

    preferences.update(SOUND_PREFERENCES, {
      volume: 80
    });

    assert.equal(player.volume.level, 0.8);
  });
});
