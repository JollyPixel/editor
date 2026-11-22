// Import Node.js Dependencies
import {
  describe,
  test,
  before
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/ecs";
import {
  ALL_FORMATS,
  BufferSource,
  Input
} from "mediabunny";

// Import Internal Dependencies
import {
  oggContentFromAudio,
  SoundState
} from "#src/index.ts";
import { summarizeOggPages } from "../helpers/oggPages.ts";
import { sineWaveFile } from "../helpers/wavFiles.ts";

// CONSTANTS
const kMusic: Partial<Systems.SoundSettings> = {
  category: "music",
  loop: true,
  volume: 0.5
};

async function computeDuration(
  content: Uint8Array
): Promise<number> {
  using input = new Input({
    source: new BufferSource(content),
    formats: ALL_FORMATS
  });

  return await input.computeDuration();
}

function readTaggedSettings(
  content: Uint8Array
): Systems.SoundSettings {
  return Systems.readSoundSettings(Systems.OggHeader.parse(content));
}

function assertValidPages(
  content: Uint8Array
): void {
  const pages = summarizeOggPages(content);
  assert.ok(pages.every((page) => page.crcValid));
  assert.deepEqual(
    pages.map((page) => page.sequence),
    pages.map((_, index) => index)
  );
}

function stateWith(
  content: Uint8Array,
  ...changes: Partial<Systems.SoundSettings>[]
): SoundState {
  const state = new SoundState();
  state.load(content);
  for (const set of changes) {
    state.applyCommand({
      action: "sound-settings-changed",
      set
    });
  }

  return state;
}

describe("SoundState", () => {
  let ogg: Uint8Array;

  before(async() => {
    ogg = await oggContentFromAudio(sineWaveFile({
      seconds: 1,
      sampleRate: 48_000,
      channels: 1
    }));
  });

  test("should write settings that the engine reads back, keeping the audio", async() => {
    const { bytes, settings } = stateWith(ogg, kMusic);

    assert.deepEqual(readTaggedSettings(bytes), settings);
    assert.equal(settings.category, "music");
    assertValidPages(bytes);
    assert.equal(await computeDuration(bytes), await computeDuration(ogg));
  });

  test("should replace the previous settings instead of adding a second tag", () => {
    const first = stateWith(ogg, kMusic).bytes;
    const second = stateWith(first, { volume: 0.7 }).bytes;

    assert.equal(readTaggedSettings(second).volume, 0.7);
    assert.equal(second.byteLength, first.byteLength);
  });

  test("should renumber the audio pages when the header grows by a page", async() => {
    const { bytes } = stateWith(ogg, { category: "c".repeat(70_000) });

    assert.equal(readTaggedSettings(bytes).category.length, 70_000);
    assertValidPages(bytes);
    assert.equal(await computeDuration(bytes), await computeDuration(ogg));
  });

  test("should keep content without a readable Ogg header read-only and unchanged", () => {
    const content = new TextEncoder().encode("OggS but not a page");
    const state = stateWith(content);

    assert.equal(state.editable, false);
    assert.equal(state.bytes, content);
  });
});
