// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  afterEach,
  mock
} from "node:test";
import assert from "node:assert/strict";
import timers from "node:timers/promises";

// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

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
