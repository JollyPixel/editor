// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AudioMixer } from "../../src/three/audio/AudioMixer.ts";
import {
  audibleGain,
  FakeAudioContext
} from "../helpers/audio/FakeAudioContext.ts";

function createMixer(): AudioMixer {
  const context = new FakeAudioContext();

  return new AudioMixer(() => {
    const output = context.createGain();
    output.connect(context.destination);

    return output as unknown as GainNode;
  });
}

describe("Audio.AudioMixer", () => {
  test("should restore a saved state, custom categories included", () => {
    const saved = createMixer();
    saved.master.volume = 0.5;
    saved.category("music").muted = true;
    saved.category("footsteps").volume = 0.25;

    const restored = createMixer();
    restored.restore(JSON.parse(JSON.stringify(saved)));

    assert.deepStrictEqual(restored.toJSON(), saved.toJSON());
    assert.strictEqual(audibleGain(restored.input("footsteps")), 0.125);
    assert.strictEqual(audibleGain(restored.input("music")), 0);
  });

  test("should ignore malformed entries when restoring", () => {
    const mixer = createMixer();

    mixer.restore({
      master: { volume: "loud", muted: true },
      sfx: null,
      ui: 3
    });

    assert.deepStrictEqual(mixer.master.toJSON(), { volume: 1, muted: true });
    assert.deepStrictEqual(mixer.category("sfx").toJSON(), { volume: 1, muted: false });
  });

  test("should clamp volumes and report each change", () => {
    const mixer = createMixer();
    const changes: [string, number][] = [];
    mixer.on("change", (category) => changes.push([category.name, category.volume]));

    mixer.category("sfx").volume = 2;
    mixer.category("sfx").volume = 1;
    mixer.master.volume = -1;

    assert.deepStrictEqual(changes, [["master", 0]]);
  });
});
