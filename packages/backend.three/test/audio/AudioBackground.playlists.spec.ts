// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { AudioBackgroundPlaylist } from "../../src/audio/AudioBackground.ts";
import {
  createAudioBackgroundHarness,
  musicTrack,
  type AudioBackgroundHarness
} from "../helpers/audio/audioBackgroundHarness.ts";

describe("Audio.AudioBackground playlists", () => {
  let harness: AudioBackgroundHarness;

  beforeEach(() => {
    harness = createAudioBackgroundHarness();
  });

  test("should loop the playlist when onEnd is loop", async() => {
    await harness.audioBackground.play([0, 1]);

    await harness.endTrack();

    assert.strictEqual(harness.audioBackground.track?.name, "track1");
  });

  test("should stop when onEnd is stop", async() => {
    await harness.audioBackground.play([1, 0]);

    await harness.endTrack();

    assert.strictEqual(harness.audioBackground.instance, null);
    assert.strictEqual(harness.audioBackground.track, null);
  });

  test("should play the next playlist when configured", async() => {
    const playlists: AudioBackgroundPlaylist[] = [
      {
        name: "first",
        tracks: [musicTrack("track1")],
        onEnd: "play-next-playlist",
        nextPlaylistName: "second"
      },
      {
        name: "second",
        tracks: [musicTrack("track2")],
        onEnd: "stop"
      }
    ];
    const background = harness.createBackground({ playlists });

    await background.play([0, 0]);
    await harness.endTrack(background);

    assert.strictEqual(background.track?.name, "track2");
  });

  test("should stop when the next playlist is not found", async() => {
    const background = harness.createBackground({
      playlists: [
        {
          name: "first",
          tracks: [musicTrack("track1")],
          onEnd: "play-next-playlist",
          nextPlaylistName: "nonexistent"
        }
      ]
    });

    await background.play([0, 0]);
    await harness.endTrack(background);

    assert.strictEqual(background.instance, null);
    assert.strictEqual(background.track, null);
  });
});
