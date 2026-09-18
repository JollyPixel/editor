// Import Node.js Dependencies
import { describe, test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { GlobalAudio } from "../../src/audio/GlobalAudio.ts";

describe("Audio.GlobalAudio", () => {
  let globalAudio: GlobalAudio;
  let mockListener: {
    getMasterVolume: ReturnType<typeof mock.fn>;
    setMasterVolume: ReturnType<typeof mock.fn>;
  };
  let currentVolume: number;

  beforeEach(() => {
    currentVolume = 1;
    mockListener = {
      getMasterVolume: mock.fn(() => currentVolume),
      setMasterVolume: mock.fn((value: number) => {
        currentVolume = value;
      })
    };

    globalAudio = new GlobalAudio(
      mockListener as any
    );
  });

  test("should initialize with provided listener adapter", () => {
    assert.strictEqual(globalAudio.listener, mockListener);
  });

  test("should get current volume", () => {
    const volume = globalAudio.volume;

    assert.strictEqual(volume, 1);
    assert.strictEqual(mockListener.getMasterVolume.mock.calls.length, 1);
  });

  test("should set volume and clamp to [0, 1]", () => {
    globalAudio.volume = 0.5;

    assert.strictEqual(mockListener.setMasterVolume.mock.calls.length, 1);
    assert.strictEqual(mockListener.setMasterVolume.mock.calls[0].arguments[0], 0.5);
  });

  test("should clamp volume to minimum 0", () => {
    globalAudio.volume = -0.5;

    assert.strictEqual(mockListener.setMasterVolume.mock.calls[0].arguments[0], 0);
  });

  test("should clamp volume to maximum 1", () => {
    globalAudio.volume = 1.5;

    assert.strictEqual(mockListener.setMasterVolume.mock.calls[0].arguments[0], 1);
  });

  test("should emit volumechange event when volume is set", () => {
    const volumeChanges: number[] = [];
    globalAudio.on("volumechange", (volume) => {
      volumeChanges.push(volume);
    });

    globalAudio.volume = 0.7;

    assert.strictEqual(volumeChanges.length, 1);
    assert.strictEqual(volumeChanges[0], 0.7);
  });

  test("should handle multiple volume changes", () => {
    const volumeChanges: number[] = [];
    globalAudio.on("volumechange", (volume) => {
      volumeChanges.push(volume);
    });

    globalAudio.volume = 0.5;
    globalAudio.volume = 0.8;
    globalAudio.volume = 0.2;

    assert.strictEqual(volumeChanges.length, 3);
    assert.deepStrictEqual(volumeChanges, [0.5, 0.8, 0.2]);
  });

  test("should get volume after setting it", () => {
    globalAudio.volume = 0.4;

    const volume = globalAudio.volume;

    assert.strictEqual(volume, 0.4);
  });

  test("should emit the clamped volume", () => {
    const observedVolumes: number[] = [];
    globalAudio.on("volumechange", (volume) => {
      observedVolumes.push(volume);
    });

    globalAudio.volume = 2.5;
    globalAudio.volume = -1.5;

    assert.deepStrictEqual(observedVolumes, [1, 0]);
  });
});
