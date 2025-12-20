// Import Node.js Dependencies
import { describe, test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import timers from "node:timers/promises";

// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import {
  AudioBackground,
  type AudioBackgroundOptions,
  type AudioBackgroundPlaylist
} from "../../src/audio/AudioBackground.ts";
import type { AudioManager } from "../../src/audio/AudioManager.ts";

// CONSTANTS
const kAsyncPropagationDelay = 10;

interface MockAudio {
  isPlaying: boolean;
  setVolume: ReturnType<typeof mock.fn<(volume: number) => void>>;
  play: ReturnType<typeof mock.fn<() => void>>;
  pause: ReturnType<typeof mock.fn<() => void>>;
  stop: ReturnType<typeof mock.fn<() => void>>;
  onEnded: (() => void) | null;
}

interface MockAudioManager {
  loadAudio: ReturnType<typeof mock.fn<(url: string, options?: any) => Promise<THREE.Audio>>>;
  destroyAudio: ReturnType<typeof mock.fn<(audio: THREE.Audio) => void>>;
}

describe("Audio.AudioBackground", () => {
  let audioBackground: AudioBackground;
  let mockAudioManager: MockAudioManager;
  let mockAudio: MockAudio;
  let playlists: AudioBackgroundPlaylist[];

  async function triggerOnEnded(): Promise<void> {
    if (mockAudio.onEnded) {
      mockAudio.onEnded();
      await timers.setTimeout(kAsyncPropagationDelay);
    }
  }

  beforeEach(() => {
    mockAudio = {
      isPlaying: false,
      setVolume: mock.fn(),
      play: mock.fn(() => {
        mockAudio.isPlaying = true;
      }),
      pause: mock.fn(() => {
        mockAudio.isPlaying = false;
      }),
      stop: mock.fn(() => {
        mockAudio.isPlaying = false;
      }),
      onEnded: null
    };

    mockAudioManager = {
      loadAudio: mock.fn(async() => mockAudio as unknown as THREE.Audio),
      destroyAudio: mock.fn()
    };

    playlists = [
      {
        name: "main",
        tracks: [
          {
            name: "track1",
            path: "/audio/track1.mp3",
            volume: 0.8
          },
          {
            name: "track2",
            path: "/audio/track2.mp3",
            volume: 0.6
          }
        ],
        onEnd: "loop"
      },
      {
        name: "secondary",
        tracks: [
          {
            name: "ambient",
            path: "/audio/ambient.mp3"
          }
        ],
        onEnd: "stop"
      }
    ];

    const options: AudioBackgroundOptions = {
      audioManager: mockAudioManager as unknown as AudioManager,
      playlists,
      autoPlay: false
    };

    audioBackground = new AudioBackground(options);
  });

  afterEach(() => {
    audioBackground.stop();
  });

  test("should initialize with correct playlists", () => {
    assert.strictEqual(audioBackground.playlists.length, 2);
    assert.strictEqual(audioBackground.playlists[0].name, "main");
    assert.strictEqual(audioBackground.playlists[1].name, "secondary");
  });

  test("should initialize with null audio and current index", () => {
    assert.strictEqual(audioBackground.audio, null);
    assert.strictEqual(audioBackground.track, null);
  });

  test("should auto-play first track when autoPlay is true", async() => {
    const options: AudioBackgroundOptions = {
      audioManager: mockAudioManager as unknown as AudioManager,
      playlists,
      autoPlay: true
    };

    const bg = new AudioBackground(options);

    await triggerOnEnded();

    assert.strictEqual(mockAudioManager.loadAudio.mock.calls.length, 1);
    assert.strictEqual(mockAudioManager.loadAudio.mock.calls[0].arguments[0], "/audio/track1.mp3");

    bg.stop();
  });

  test("should auto-play specific track when autoPlay is a path", async() => {
    const options: AudioBackgroundOptions = {
      audioManager: mockAudioManager as unknown as AudioManager,
      playlists,
      autoPlay: "secondary.ambient"
    };

    const bg = new AudioBackground(options);

    await triggerOnEnded();

    assert.strictEqual(mockAudioManager.loadAudio.mock.calls.length, 1);
    assert.strictEqual(mockAudioManager.loadAudio.mock.calls[0].arguments[0], "/audio/ambient.mp3");

    bg.stop();
  });

  test("should auto-play specific track when autoPlay is an index", async() => {
    const options: AudioBackgroundOptions = {
      audioManager: mockAudioManager as unknown as AudioManager,
      playlists,
      autoPlay: [0, 1]
    };

    const bg = new AudioBackground(options);

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

  test("should loop playlist when onEnd is loop", async() => {
    await audioBackground.play([0, 1]);

    await triggerOnEnded();

    assert.strictEqual(mockAudioManager.loadAudio.mock.calls.length, 2);
    assert.strictEqual(mockAudioManager.loadAudio.mock.calls[1].arguments[0], "/audio/track1.mp3");
  });

  test("should stop when onEnd is stop", async() => {
    await audioBackground.play([1, 0]);

    await triggerOnEnded();

    assert.strictEqual(audioBackground.audio, null);
    assert.strictEqual(audioBackground.track, null);
  });

  test("should play next playlist when configured", async() => {
    const playlistsWithNext: AudioBackgroundPlaylist[] = [
      {
        name: "first",
        tracks: [
          {
            name: "track1",
            path: "/audio/track1.mp3"
          }
        ],
        onEnd: "play-next-playlist",
        nextPlaylistName: "second"
      },
      {
        name: "second",
        tracks: [
          {
            name: "track2",
            path: "/audio/track2.mp3"
          }
        ],
        onEnd: "stop"
      }
    ];

    const bg = new AudioBackground({
      audioManager: mockAudioManager as unknown as AudioManager,
      playlists: playlistsWithNext,
      autoPlay: false
    });

    await bg.play([0, 0]);
    await triggerOnEnded();

    assert.strictEqual(mockAudioManager.loadAudio.mock.calls.length, 2);
    assert.strictEqual(mockAudioManager.loadAudio.mock.calls[1].arguments[0], "/audio/track2.mp3");

    bg.stop();
  });

  test("should stop if next playlist is not found", async() => {
    const playlistsWithInvalidNext: AudioBackgroundPlaylist[] = [
      {
        name: "first",
        tracks: [
          {
            name: "track1",
            path: "/audio/track1.mp3"
          }
        ],
        onEnd: "play-next-playlist",
        nextPlaylistName: "nonexistent"
      }
    ];

    const bg = new AudioBackground({
      audioManager: mockAudioManager as unknown as AudioManager,
      playlists: playlistsWithInvalidNext,
      autoPlay: false
    });

    await bg.play([0, 0]);
    await triggerOnEnded();

    assert.strictEqual(bg.audio, null);

    bg.stop();
  });

  test("should pause audio when playing", () => {
    audioBackground.audio = mockAudio as any;
    mockAudio.isPlaying = true;

    audioBackground.pause();

    assert.strictEqual(mockAudio.pause.mock.calls.length, 1);
  });

  test("should not pause if audio is not playing", () => {
    audioBackground.audio = mockAudio as any;
    mockAudio.isPlaying = false;

    audioBackground.pause();

    assert.strictEqual(mockAudio.pause.mock.calls.length, 0);
  });

  test("should resume audio when paused", () => {
    audioBackground.audio = mockAudio as any;
    mockAudio.isPlaying = false;

    audioBackground.resume();

    assert.strictEqual(mockAudio.play.mock.calls.length, 1);
  });

  test("should not resume if audio is already playing", () => {
    audioBackground.audio = mockAudio as any;
    mockAudio.isPlaying = true;

    audioBackground.resume();

    assert.strictEqual(mockAudio.play.mock.calls.length, 0);
  });

  test("should stop audio and reset state", () => {
    audioBackground.audio = mockAudio as any;

    audioBackground.stop();

    assert.strictEqual(mockAudioManager.destroyAudio.mock.calls.length, 1);
    assert.strictEqual(audioBackground.audio, null);
    assert.strictEqual(audioBackground.track, null);
  });

  test("should return correct isPlaying state", async() => {
    assert.strictEqual(audioBackground.isPlaying, false);

    await audioBackground.play([0, 0]);
    mockAudio.isPlaying = true;

    assert.strictEqual(audioBackground.isPlaying, true);

    audioBackground.stop();

    assert.strictEqual(audioBackground.isPlaying, false);
  });

  test("should return correct isPaused state", async() => {
    assert.strictEqual(audioBackground.isPaused, false);

    await audioBackground.play([0, 0]);
    mockAudio.isPlaying = false;

    assert.strictEqual(audioBackground.isPaused, true);
  });

  test("should update volume when master volume changes", async() => {
    await audioBackground.play([0, 0]);

    audioBackground.onMasterVolumeChange(0.5);

    assert.strictEqual(mockAudio.setVolume.mock.calls.length, 1);
    assert.strictEqual(mockAudio.setVolume.mock.calls[0].arguments[0], 0.4);
  });

  test("should not update volume if audio is null", () => {
    audioBackground.onMasterVolumeChange(0.5);

    assert.strictEqual(mockAudio.setVolume.mock.calls.length, 0);
  });

  test("should use default volume of 1 when track volume is not specified", async() => {
    await audioBackground.play([1, 0]);

    audioBackground.onMasterVolumeChange(0.8);

    assert.strictEqual(mockAudio.setVolume.mock.calls[0].arguments[0], 0.8);
  });

  test("should handle errors with custom error handler", async() => {
    const errors: Error[] = [];

    function customErrorHandler(error: Error) {
      errors.push(error);
    }

    const bg = new AudioBackground({
      audioManager: mockAudioManager as unknown as AudioManager,
      playlists,
      autoPlay: false,
      onError: customErrorHandler
    });

    await bg.play([0, 0]);

    const testError = new Error("Test error");

    // Simuler une erreur lors de playNext() via onEnded
    mockAudioManager.loadAudio = mock.fn(async() => {
      throw testError;
    });
    await triggerOnEnded();

    assert.strictEqual(errors.length, 1);
    assert.strictEqual(errors[0], testError);

    bg.stop();
  });

  test("should get track by path correctly", async() => {
    await audioBackground.play("main.track1");

    assert.strictEqual(audioBackground.track?.name, "track1");
    assert.strictEqual(audioBackground.track?.path, "/audio/track1.mp3");
  });

  test("should get track by index correctly", async() => {
    await audioBackground.play([0, 1]);

    assert.strictEqual(audioBackground.track?.name, "track2");
    assert.strictEqual(audioBackground.track?.path, "/audio/track2.mp3");
  });

  test("should return null track when no audio is playing", () => {
    assert.strictEqual(audioBackground.track, null);
  });

  test("should handle playlist with empty tracks array", () => {
    const emptyPlaylist: AudioBackgroundPlaylist[] = [
      {
        name: "empty",
        tracks: [],
        onEnd: "stop"
      }
    ];

    const bg = new AudioBackground({
      audioManager: mockAudioManager as unknown as AudioManager,
      playlists: emptyPlaylist,
      autoPlay: false
    });

    assert.strictEqual(bg.playlists.length, 1);

    bg.stop();
  });
});
