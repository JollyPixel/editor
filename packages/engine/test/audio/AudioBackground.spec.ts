// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  afterEach,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  AudioBackground,
  AudioBackgroundPlaylist
} from "../../src/audio/AudioBackground.ts";
import {
  createAudioBackgroundHarness,
  type AudioBackgroundHarness
} from "../helpers/audio/audioBackgroundHarness.ts";

describe("Audio.AudioBackground", () => {
  let audioBackground: AudioBackground;
  let mockAudioManager: AudioBackgroundHarness["mockAudioManager"];
  let mockAudio: AudioBackgroundHarness["mockAudio"];
  let playlists: AudioBackgroundPlaylist[];
  let createBackground: AudioBackgroundHarness["createBackground"];
  let triggerOnEnded: AudioBackgroundHarness["triggerOnEnded"];

  beforeEach(() => {
    ({
      audioBackground,
      mockAudioManager,
      mockAudio,
      playlists,
      createBackground,
      triggerOnEnded
    } = createAudioBackgroundHarness());
  });

  afterEach(() => {
    audioBackground.stop();
  });

  test("should start with no audio and no track", () => {
    assert.strictEqual(audioBackground.audio, null);
    assert.strictEqual(audioBackground.track, null);
  });

  test("should handle errors with custom error handler", async() => {
    const errors: Error[] = [];

    function customErrorHandler(error: Error) {
      errors.push(error);
    }

    const bg = createBackground({
      onError: customErrorHandler
    });

    await bg.play([0, 0]);

    const testError = new Error("Test error");

    mockAudioManager.loadAudio = mock.fn(async() => {
      throw testError;
    });
    await triggerOnEnded();

    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0], testError);

    bg.stop();
  });

  test("should auto-play first track when autoPlay is true", async() => {
    const bg = createBackground({ autoPlay: true });

    await triggerOnEnded();

    assert.strictEqual(mockAudioManager.loadAudio.mock.calls.length, 1);
    assert.strictEqual(mockAudioManager.loadAudio.mock.calls[0].arguments[0], "/audio/track1.mp3");

    bg.stop();
  });

  test("should auto-play specific track when autoPlay is a path", async() => {
    const bg = createBackground({ autoPlay: "secondary.ambient" });

    await triggerOnEnded();

    assert.strictEqual(mockAudioManager.loadAudio.mock.calls.length, 1);
    assert.strictEqual(mockAudioManager.loadAudio.mock.calls[0].arguments[0], "/audio/ambient.mp3");

    bg.stop();
  });

  test("should auto-play specific track when autoPlay is an index", async() => {
    const bg = createBackground({ autoPlay: [0, 1] });

    await triggerOnEnded();

    assert.strictEqual(mockAudioManager.loadAudio.mock.calls.length, 1);
    assert.strictEqual(mockAudioManager.loadAudio.mock.calls[0].arguments[0], "/audio/track2.mp3");

    bg.stop();
  });

  test("should load and play track by index", async() => {
    await audioBackground.play([0, 0]);

    assert.strictEqual(mockAudioManager.loadAudio.mock.calls.length, 1);
    assert.strictEqual(mockAudioManager.loadAudio.mock.calls[0].arguments[0], "/audio/track1.mp3");
    assert.deepStrictEqual(mockAudioManager.loadAudio.mock.calls[0].arguments[1], {
      name: "track1",
      volume: 0.8
    });
    assert.strictEqual(mockAudio.play.mock.calls.length, 1);
    assert.strictEqual(audioBackground.track?.name, "track1");
  });

  test("should load and play track by path", async() => {
    await audioBackground.play("main.track2");

    assert.strictEqual(mockAudioManager.loadAudio.mock.calls.length, 1);
    assert.strictEqual(mockAudioManager.loadAudio.mock.calls[0].arguments[0], "/audio/track2.mp3");
    assert.strictEqual(audioBackground.track?.name, "track2");
  });

  test("should throw error for invalid track path", async() => {
    await assert.rejects(
      () => audioBackground.play("invalid.track"),
      {
        name: "Error",
        message: /Track not found: invalid\.track/
      }
    );
  });

  test("should throw error for invalid track index", async() => {
    await assert.rejects(
      () => audioBackground.play([10, 0]),
      /Track not found:/
    );
  });

  test("should resume playing when play is called without arguments", async() => {
    await audioBackground.play([0, 0]);
    mockAudio.isPlaying = false;

    await audioBackground.play();

    assert.strictEqual(mockAudio.play.mock.calls.length, 2);
  });

  test("should stop previous audio before playing new one", async() => {
    await audioBackground.play([0, 0]);

    const firstAudio = audioBackground.audio;

    await audioBackground.play([0, 1]);

    assert.strictEqual(mockAudioManager.destroyAudio.mock.calls.length, 1);
    assert.strictEqual(mockAudioManager.destroyAudio.mock.calls[0].arguments[0], firstAudio);
  });

  test("should play next track in playlist", async() => {
    await audioBackground.play([0, 0]);

    await triggerOnEnded();

    assert.strictEqual(mockAudioManager.loadAudio.mock.calls.length, 2);
    assert.strictEqual(mockAudioManager.loadAudio.mock.calls[1].arguments[0], "/audio/track2.mp3");
  });

  test("should keep advancing after the first track change", async() => {
    playlists[0].tracks.push({
      name: "track3",
      path: "/audio/track3.mp3"
    });
    await audioBackground.play([0, 0]);

    await triggerOnEnded();
    assert.strictEqual(audioBackground.track?.name, "track2");

    await triggerOnEnded();
    assert.strictEqual(audioBackground.track?.name, "track3");
    assert.deepStrictEqual(
      mockAudioManager.loadAudio.mock.calls.map((call) => call.arguments[0]),
      ["/audio/track1.mp3", "/audio/track2.mp3", "/audio/track3.mp3"]
    );
  });

  test("should discard a track that finishes loading after a newer request", async() => {
    const first = audioBackground.play([0, 0]);
    const second = audioBackground.play([0, 1]);
    await Promise.all([first, second]);

    assert.strictEqual(audioBackground.track?.name, "track2");
    assert.strictEqual(mockAudioManager.destroyAudio.mock.calls.length, 1);
  });
});
