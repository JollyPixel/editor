// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { InvalidAssetFileError } from "@jolly-pixel/asset-server";
import {
  ALL_FORMATS,
  BufferSource,
  Input
} from "mediabunny";

// Import Internal Dependencies
import { soundAssetKind } from "#src/index.ts";
import { sineWaveFile } from "../helpers/wavFiles.ts";

// CONSTANTS
const kHandler = soundAssetKind();

async function convert(
  extension: string,
  content: Uint8Array
): Promise<Uint8Array> {
  const conversion = kHandler.conversions?.[extension];
  assert.ok(conversion !== undefined);

  return (await conversion(content)).content;
}

describe("soundAssetKind", () => {
  test("converts a .wav file into Ogg Opus that it loads and serializes back", async() => {
    const content = await convert(".wav", sineWaveFile({
      seconds: 1,
      sampleRate: 44_100,
      channels: 2
    }));
    const state = kHandler.create("sound-1");
    kHandler.load(state, content);

    using input = new Input({
      source: new BufferSource(content),
      formats: ALL_FORMATS
    });
    const track = await input.getPrimaryAudioTrack();
    assert.equal(track?.codec, "opus");
    assert.equal(track?.numberOfChannels, 2);
    assert.equal(Math.round(await input.computeDuration()), 1);
    assert.deepEqual(await kHandler.serialize(state), content);
  });

  test("refuses to convert a file that holds no audio", async() => {
    await assert.rejects(
      convert(".mp3", new TextEncoder().encode("not a sound")),
      InvalidAssetFileError
    );
  });

  test("refuses to load content that is not an Ogg file", () => {
    const state = kHandler.create("sound-1");

    assert.throws(
      () => kHandler.load(state, sineWaveFile({
        seconds: 0.1,
        sampleRate: 8_000,
        channels: 1
      })),
      InvalidAssetFileError
    );
  });
});
