// Import Node.js Dependencies
import { describe, test, mock } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import { GlobalAudioManager } from "../../src/audio/AudioManager.ts";

function createGainNode() {
  return {
    gain: {
      value: 1,
      setTargetAtTime(value: number) {
        this.value = value;
      }
    },
    connect: mock.fn(),
    disconnect: mock.fn()
  };
}

function createListener(
  masterVolume = 1
) {
  const input = createGainNode();
  input.gain.value = masterVolume;

  return {
    context: {
      currentTime: 0,
      createGain: createGainNode,
      createPanner: () => {
        return { ...createGainNode(), panningModel: "" };
      }
    },
    getInput: () => input,
    getMasterVolume: () => input.gain.value
  } as unknown as THREE.AudioListener;
}

function createBuffer() {
  return { duration: 1 } as unknown as AudioBuffer;
}

describe("Audio.GlobalAudioManager", () => {
  test("should load each url once and share the buffer", async() => {
    const buffer = createBuffer();
    const loadBuffer = mock.fn(async(_url: string) => buffer);
    const manager = new GlobalAudioManager({
      listener: createListener(),
      loadBuffer
    });

    const [first, second] = await Promise.all([
      manager.loadAudio("theme.mp3"),
      manager.loadAudio("theme.mp3")
    ]);

    assert.strictEqual(loadBuffer.mock.callCount(), 1);
    assert.strictEqual(first.buffer, buffer);
    assert.strictEqual(second.buffer, buffer);
  });

  test("should retry a url whose load failed", async() => {
    const buffer = createBuffer();
    let attempts = 0;
    const manager = new GlobalAudioManager({
      listener: createListener(),
      loadBuffer: async() => {
        attempts++;
        if (attempts === 1) {
          throw new Error("network");
        }

        return buffer;
      }
    });

    await assert.rejects(manager.loadAudio("theme.mp3"), /network/);
    const audio = await manager.loadAudio("theme.mp3");

    assert.strictEqual(audio.buffer, buffer);
  });

  test("should leave the master volume to the listener", () => {
    const manager = new GlobalAudioManager({
      listener: createListener(0.5)
    });

    const audio = manager.createAudio(createBuffer(), {
      volume: 0.8,
      loop: true,
      name: "theme"
    });

    assert.strictEqual(audio.getVolume(), 0.8);
    assert.strictEqual(audio.getLoop(), true);
    assert.strictEqual(audio.name, "theme");
  });
});
