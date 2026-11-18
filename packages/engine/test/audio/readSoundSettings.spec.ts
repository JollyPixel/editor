// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  SOUND_SETTINGS_DEFAULTS,
  SOUND_SETTINGS_TAG,
  type SoundSettings,
  readSoundSettings
} from "../../src/core/systems/audio/SoundSettings.ts";
import { OggHeader } from "../../src/core/systems/audio/OggHeader.ts";
import {
  commentPacket,
  oggStream
} from "../helpers/audio/oggStream.ts";

// CONSTANTS
const kOpusHead = new TextEncoder().encode("OpusHead\x01\x02");
const kVorbisIdentification = new TextEncoder().encode("\x01vorbis");
const kVorbisSetup = new TextEncoder().encode("\x05vorbis");
const kSettings = `${SOUND_SETTINGS_TAG}={"category":"music","loop":true}`;

function readTaggedSettings(
  bytes: Uint8Array
): SoundSettings {
  return readSoundSettings(OggHeader.parse(bytes));
}

describe("readSoundSettings", () => {
  test("should read the settings tag of an Ogg Opus file", () => {
    const bytes = oggStream([
      kOpusHead,
      commentPacket("OpusTags", ["TITLE=Theme", kSettings])
    ]);

    const settings = readTaggedSettings(bytes);

    assert.strictEqual(settings.category, "music");
    assert.strictEqual(settings.loop, true);
  });

  test("should read the settings tag of an Ogg Vorbis file, whatever its key case", () => {
    const bytes = oggStream([
      kVorbisIdentification,
      commentPacket("\x03vorbis", [kSettings.replace(SOUND_SETTINGS_TAG, "jollypixel_sound")]),
      kVorbisSetup
    ]);

    assert.strictEqual(readTaggedSettings(bytes).category, "music");
  });

  test("should read a comment packet spread over several pages", () => {
    const bytes = oggStream([
      kOpusHead,
      commentPacket("OpusTags", [kSettings], "v".repeat(70_000))
    ]);

    assert.strictEqual(readTaggedSettings(bytes).category, "music");
  });

  test("should fall back to the defaults without a valid settings tag", () => {
    const withoutTag = oggStream([
      kOpusHead,
      commentPacket("OpusTags", ["TITLE=Theme"])
    ]);
    const invalidJSON = oggStream([
      kOpusHead,
      commentPacket("OpusTags", [`${SOUND_SETTINGS_TAG}={`])
    ]);
    const notOgg = new TextEncoder().encode("RIFF....WAVE");

    for (const bytes of [withoutTag, invalidJSON, notOgg]) {
      assert.deepStrictEqual(readTaggedSettings(bytes), SOUND_SETTINGS_DEFAULTS);
    }
  });
});
