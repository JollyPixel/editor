// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { AudioBackgroundOptions } from "../../src/audio/AudioBackground.ts";
import { Sound } from "../../src/audio/Sound.ts";
import {
  createAudioBackgroundHarness,
  musicTrack,
  type AudioBackgroundHarness
} from "../helpers/audio/audioBackgroundHarness.ts";
import {
  fakeAudioBuffer,
  type FakeBufferSource
} from "../helpers/audio/FakeAudioContext.ts";

describe("Audio.AudioBackground", () => {
  let harness: AudioBackgroundHarness;

  beforeEach(() => {
    harness = createAudioBackgroundHarness();
  });

  test("should start with no sound and no track", () => {
    assert.strictEqual(harness.audioBackground.instance, null);
    assert.strictEqual(harness.audioBackground.track, null);
  });

  test("should play a track on the music category with its volume", async() => {
    await harness.audioBackground.play([0, 0]);

    const { instance, track } = harness.audioBackground;
    assert.strictEqual(track?.name, "track1");
    assert.strictEqual(instance?.settings.category, "music");
    assert.strictEqual(instance?.volume, 0.8);
    assert.deepStrictEqual(harness.loadedTracks(), ["track1"]);
  });

  test("should play a track given as a sound without loading it", async() => {
    const sound = new Sound(fakeAudioBuffer());
    const background = harness.createBackground({
      assets: undefined,
      playlists: [{ name: "inline", tracks: [{ name: "theme", sound }] }]
    });

    await background.play("inline.theme");

    assert.strictEqual(background.instance?.sound, sound);
  });

  test("should start music asked for before the page allows sound", async() => {
    harness.context.state = "suspended";

    await harness.audioBackground.play([0, 0]);

    assert.strictEqual(harness.audioBackground.isPlaying, true);
  });

  const autoPlays: [AudioBackgroundOptions["autoPlay"], string][] = [
    [true, "track1"],
    ["secondary.ambient", "ambient"],
    [[0, 1], "track2"]
  ];
  for (const [autoPlay, expected] of autoPlays) {
    test(`should auto-play ${expected} when autoPlay is ${JSON.stringify(autoPlay)}`, async() => {
      const background = harness.createBackground({ autoPlay });
      await harness.settle();

      assert.strictEqual(background.track?.name, expected);
      assert.deepStrictEqual(harness.loadedTracks(), [expected]);
    });
  }

  test("should reject a track that does not exist", async() => {
    await assert.rejects(
      () => harness.audioBackground.play("invalid.track"),
      /Track not found: invalid\.track/
    );
    await assert.rejects(
      () => harness.audioBackground.play([10, 0]),
      /Track not found:/
    );
  });

  test("should report a track that fails to load while advancing", async() => {
    const errors: unknown[] = [];
    const background = harness.createBackground({
      onError: (error) => errors.push(error)
    });
    await background.play([0, 0]);
    const failure = new Error("network");
    harness.assets.load.mock.mockImplementation(async() => {
      throw failure;
    });

    await harness.endTrack(background);

    assert.deepStrictEqual(errors, [failure]);
  });

  test("should pause and resume the current track", async() => {
    await harness.audioBackground.play([0, 0]);

    harness.audioBackground.pause();
    assert.strictEqual(harness.audioBackground.isPaused, true);

    await harness.audioBackground.play();
    assert.strictEqual(harness.audioBackground.isPlaying, true);
  });

  test("should crossfade into a newly played track", async() => {
    const background = harness.createBackground({ crossfade: 2 });
    await background.play([0, 0]);
    const first = background.instance;

    await background.play([0, 1]);

    assert.strictEqual(first?.state, "stopped");
    assert.strictEqual(background.track?.name, "track2");
    assert.deepStrictEqual([...harness.audio.voices], [first, background.instance]);

    assert.ok(first);
    (first.audio.source as unknown as FakeBufferSource).end();
    assert.deepStrictEqual([...harness.audio.voices], [background.instance]);
  });

  test("should keep advancing after the first track change", async() => {
    harness.playlists[0].tracks.push(musicTrack("track3"));
    await harness.audioBackground.play([0, 0]);

    await harness.endTrack();
    await harness.endTrack();

    assert.strictEqual(harness.audioBackground.track?.name, "track3");
    assert.deepStrictEqual(harness.loadedTracks(), ["track1", "track2", "track3"]);
  });

  test("should discard a track that finishes loading after a newer request", async() => {
    await Promise.all([
      harness.audioBackground.play([0, 0]),
      harness.audioBackground.play([0, 1])
    ]);

    assert.strictEqual(harness.audioBackground.track?.name, "track2");
    assert.strictEqual(harness.audio.voices.size, 1);
  });
});
