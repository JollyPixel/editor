// Import Node.js Dependencies
import { describe, test, beforeEach, mock, type Mock } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  GlobalAudioManager,
  type AudioLoadingOptions
} from "../../src/audio/AudioManager.js";
import type { AudioListenerAdapter } from "../../src/audio/internals/AudioListener.js";

/**
 * These tests are currently skipped because they depend on THREE.js's Audio and PositionalAudio classes
 */
describe.skip("Audio.GlobalAudioManager", () => {
  let manager: GlobalAudioManager;
  let mockListener: {
    getMasterVolume: Mock<() => number>;
    setMasterVolume: Mock<(value: number) => void>;
  };
  let mockCache: {
    get: Mock<(key: string) => AudioBuffer | undefined>;
    set: Mock<(key: string, buffer: AudioBuffer) => void>;
    has: Mock<(key: string) => boolean>;
    clear: Mock<() => void>;
  };
  let mockLoader: {
    load: Mock<(url: string) => Promise<AudioBuffer>>;
  };
  let mockAudioBuffer: AudioBuffer;

  beforeEach(() => {
    mockAudioBuffer = {
      length: 1,
      sampleRate: 44100,
      duration: 0.000023,
      numberOfChannels: 2,
      getChannelData: mock.fn(),
      copyFromChannel: mock.fn(),
      copyToChannel: mock.fn()
    } as unknown as AudioBuffer;

    mockListener = {
      getMasterVolume: mock.fn(() => 1),
      setMasterVolume: mock.fn()
    };

    mockCache = {
      get: mock.fn(),
      set: mock.fn(),
      has: mock.fn(() => false),
      clear: mock.fn()
    };

    mockLoader = {
      load: mock.fn(async() => mockAudioBuffer)
    };

    manager = new GlobalAudioManager({
      listener: mockListener as AudioListenerAdapter
    });
  });

  test("should load audio buffer from loader when not cached", async() => {
    const url = "test-audio.mp3";

    await manager.loadAudio(url);

    assert.strictEqual(mockCache.has.mock.calls.length, 1);
    assert.strictEqual(mockCache.has.mock.calls[0].arguments[0], url);
    assert.strictEqual(mockLoader.load.mock.calls.length, 1);
    assert.strictEqual(mockLoader.load.mock.calls[0].arguments[0], url);
    assert.strictEqual(mockCache.set.mock.calls.length, 1);
    assert.strictEqual(mockCache.set.mock.calls[0].arguments[0], url);
  });

  test("should use cached audio buffer when available", async() => {
    const url = "cached-audio.mp3";
    mockCache.has = mock.fn(() => true);
    mockCache.get = mock.fn(() => mockAudioBuffer);

    await manager.loadAudio(url);

    assert.strictEqual(mockCache.has.mock.calls.length, 1);
    assert.strictEqual(mockCache.get.mock.calls.length, 1);
    assert.strictEqual(mockLoader.load.mock.calls.length, 0);
    assert.strictEqual(mockCache.set.mock.calls.length, 0);
  });

  test("should create THREE.Audio with correct configuration", async() => {
    const options: AudioLoadingOptions = {
      name: "test-sound",
      loop: true,
      volume: 0.5
    };

    const audio = await manager.loadAudio("test.mp3", options);

    assert.strictEqual(audio.name, "test-sound");
    assert.strictEqual(audio.loop, true);
    assert.strictEqual(audio.getVolume(), 0.5);
  });

  test("should apply default options when not provided", async() => {
    const audio = await manager.loadAudio("test.mp3");

    assert.strictEqual(audio.loop, false);
    assert.strictEqual(audio.getVolume(), 1);
  });

  test("should multiply volume by master volume", async() => {
    mockListener.getMasterVolume = mock.fn(() => 0.8);

    const audio = await manager.loadAudio("test.mp3", { volume: 0.5 });

    assert.strictEqual(audio.getVolume(), 0.4);
  });

  test("should create THREE.PositionalAudio with correct configuration", async() => {
    const options: AudioLoadingOptions = {
      name: "positional-sound",
      loop: false,
      volume: 0.7
    };

    const audio = await manager.loadPositionalAudio("test.mp3", options);

    assert.strictEqual(audio.name, "positional-sound");
    assert.strictEqual(audio.loop, false);
    assert.strictEqual(audio.getVolume(), 0.7);
  });

  test("should load positional audio from cache", async() => {
    const url = "cached-positional.mp3";
    mockCache.has = mock.fn(() => true);
    mockCache.get = mock.fn(() => mockAudioBuffer);

    await manager.loadPositionalAudio(url);

    assert.strictEqual(mockCache.has.mock.calls.length, 1);
    assert.strictEqual(mockLoader.load.mock.calls.length, 0);
  });

  test("should destroy playing audio", async() => {
    const audio = await manager.loadAudio("test.mp3");
    audio.play();

    manager.destroyAudio(audio);

    assert.strictEqual(audio.isPlaying, false);
    assert.strictEqual(audio.buffer, null);
  });

  test("should destroy non-playing audio", async() => {
    const audio = await manager.loadAudio("test.mp3");

    manager.destroyAudio(audio);

    assert.strictEqual(audio.buffer, null);
  });

  test("should destroy positional audio", async() => {
    const audio = await manager.loadPositionalAudio("test.mp3");
    audio.play();

    manager.destroyAudio(audio);

    assert.strictEqual(audio.isPlaying, false);
    assert.strictEqual(audio.buffer, null);
  });

  test("should handle multiple audio loads with same URL", async() => {
    const url = "shared-audio.mp3";

    await manager.loadAudio(url);
    await manager.loadAudio(url);

    assert.strictEqual(mockLoader.load.mock.calls.length, 1);
    assert.strictEqual(mockCache.set.mock.calls.length, 1);
  });
});
