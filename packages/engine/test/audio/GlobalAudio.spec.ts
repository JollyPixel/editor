// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  mock
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";

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

  test("should clamp the master volume it sets to [0, 1]", () => {
    globalAudio.volume = 0.5;
    globalAudio.volume = -0.5;
    globalAudio.volume = 1.5;

    assert.deepStrictEqual(
      mockListener.setMasterVolume.mock.calls.map((call) => call.arguments[0]),
      [0.5, 0, 1]
    );
  });

  test("should emit each volume change, clamped", () => {
    const observedVolumes: number[] = [];
    globalAudio.on("volumechange", (volume) => {
      observedVolumes.push(volume);
    });

    globalAudio.volume = 0.7;
    globalAudio.volume = 2.5;
    globalAudio.volume = -1.5;

    assert.deepStrictEqual(observedVolumes, [0.7, 1, 0]);
  });
});

describe("Audio.GlobalAudio without a provided listener", () => {
  let createGain: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    createGain = mock.fn(() => {
      return {
        connect: () => undefined
      };
    });
    THREE.AudioContext.setContext({
      createGain,
      destination: {}
    });
  });

  test("should not create an audio graph before the listener is used", () => {
    const globalAudio = new GlobalAudio();

    assert.strictEqual(createGain.mock.calls.length, 0);

    const listener = globalAudio.listener;

    assert.strictEqual(createGain.mock.calls.length, 1);
    assert.strictEqual(globalAudio.threeAudioListener, listener);
  });
});
