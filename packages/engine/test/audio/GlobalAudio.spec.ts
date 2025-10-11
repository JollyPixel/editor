// Import Node.js Dependencies
import { describe, test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  GlobalAudio,
  type VolumeObserver
} from "../../src/audio/GlobalAudio.js";

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

  test("should notify observers when volume changes", () => {
    const observedVolumes: number[] = [];
    const observer: VolumeObserver = {
      onMasterVolumeChange: (volume) => {
        observedVolumes.push(volume);
      }
    };

    globalAudio.observe(observer);
    globalAudio.volume = 0.6;

    assert.strictEqual(observedVolumes.length, 1);
    assert.strictEqual(observedVolumes[0], 0.6);
  });

  test("should register an observer", () => {
    const onMasterVolumeChange = mock.fn();
    const observer: VolumeObserver = {
      onMasterVolumeChange
    };

    const result = globalAudio.observe(observer);

    assert.strictEqual(result, globalAudio);

    globalAudio.volume = 0.5;

    assert.strictEqual(onMasterVolumeChange.mock.calls.length, 1);
  });

  test("should not register the same observer twice", () => {
    const observedVolumes: number[] = [];
    const observer: VolumeObserver = {
      onMasterVolumeChange: (volume) => {
        observedVolumes.push(volume);
      }
    };

    globalAudio.observe(observer);
    globalAudio.observe(observer);
    globalAudio.volume = 0.8;

    assert.strictEqual(observedVolumes.length, 1);
  });

  test("should unregister an observer", () => {
    const onMasterVolumeChange = mock.fn();
    const observer: VolumeObserver = {
      onMasterVolumeChange
    };

    globalAudio.observe(observer);
    const result = globalAudio.unobserve(observer);

    assert.strictEqual(result, globalAudio);

    globalAudio.volume = 0.5;

    assert.strictEqual(onMasterVolumeChange.mock.calls.length, 0);
  });

  test("should handle unobserving non-registered observer gracefully", () => {
    const onMasterVolumeChange = mock.fn();
    const observer: VolumeObserver = {
      onMasterVolumeChange
    };

    globalAudio.unobserve(observer);

    globalAudio.volume = 0.5;

    assert.strictEqual(onMasterVolumeChange.mock.calls.length, 0);
  });

  test("should notify multiple observers", () => {
    const observer1Volumes: number[] = [];
    const observer2Volumes: number[] = [];

    const observer1: VolumeObserver = {
      onMasterVolumeChange: (volume) => {
        observer1Volumes.push(volume);
      }
    };

    const observer2: VolumeObserver = {
      onMasterVolumeChange: (volume) => {
        observer2Volumes.push(volume);
      }
    };

    globalAudio.observe(observer1);
    globalAudio.observe(observer2);
    globalAudio.volume = 0.3;

    assert.strictEqual(observer1Volumes.length, 1);
    assert.strictEqual(observer2Volumes.length, 1);
    assert.strictEqual(observer1Volumes[0], 0.3);
    assert.strictEqual(observer2Volumes[0], 0.3);
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

  test("should support method chaining for observe", () => {
    const onMasterVolumeChange = mock.fn();
    const observer1: VolumeObserver = {
      onMasterVolumeChange
    };

    const onMasterVolumeChangeBis = mock.fn();
    const observer2: VolumeObserver = {
      onMasterVolumeChange: onMasterVolumeChangeBis
    };

    const result = globalAudio
      .observe(observer1)
      .observe(observer2);

    assert.strictEqual(result, globalAudio);

    globalAudio.volume = 0.5;

    assert.strictEqual(onMasterVolumeChange.mock.calls.length, 1);
    assert.strictEqual(onMasterVolumeChangeBis.mock.calls.length, 1);
  });

  test("should support method chaining for unobserve", () => {
    const onMasterVolumeChange = mock.fn();
    const observer1: VolumeObserver = {
      onMasterVolumeChange
    };

    const onMasterVolumeChangeBis = mock.fn();
    const observer2: VolumeObserver = {
      onMasterVolumeChange: onMasterVolumeChangeBis
    };

    const result = globalAudio
      .observe(observer1)
      .observe(observer2)
      .unobserve(observer1)
      .unobserve(observer2);

    assert.strictEqual(result, globalAudio);

    globalAudio.volume = 0.5;

    assert.strictEqual(onMasterVolumeChange.mock.calls.length, 0);
    assert.strictEqual(onMasterVolumeChangeBis.mock.calls.length, 0);
  });

  test("should get volume after setting it", () => {
    globalAudio.volume = 0.4;

    const volume = globalAudio.volume;

    assert.strictEqual(volume, 0.4);
  });

  test("should notify observers with clamped volume value", () => {
    const observedVolumes: number[] = [];
    const observer: VolumeObserver = {
      onMasterVolumeChange: (volume) => {
        observedVolumes.push(volume);
      }
    };

    globalAudio.observe(observer);
    globalAudio.volume = 2.5;

    assert.strictEqual(observedVolumes[0], 1);

    globalAudio.volume = -1.5;

    assert.strictEqual(observedVolumes[1], 0);
  });
});
