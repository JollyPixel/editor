// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine/core";

// Import Internal Dependencies
import { oggContentFromAudio } from "#src/index.ts";
import {
  SoundDocument,
  type SoundImage
} from "#src/network/SoundDocument.ts";
import { sineWaveFile } from "../helpers/wavFiles.ts";

describe("SoundDocument", () => {
  test("holds no bytes when the stored content is zero bytes long", () => {
    const document = new SoundDocument();
    document.load(new Uint8Array(0));

    assert.equal(document.bytes, null);
    assert.equal(document.change({ volume: 0.5 }), false);
  });

  test("restores the settings and bytes a change replaced when rewound", async() => {
    const ogg = await oggContentFromAudio(sineWaveFile({
      seconds: 0.5,
      sampleRate: 48_000,
      channels: 1
    }));
    const document = new SoundDocument();
    document.load(ogg);
    const images: SoundImage[] = [];
    document.on("change", (change) => images.push(change.image));

    document.change({ category: "music" });
    document.change({ volume: 0.25 });
    document.revert(images);

    assert.deepEqual(document.settings, Systems.SOUND_SETTINGS_DEFAULTS);
    assert.deepEqual(
      Systems.readSoundSettings(
        Systems.OggHeader.parse(document.bytes ?? new Uint8Array())
      ),
      Systems.SOUND_SETTINGS_DEFAULTS
    );
  });
});
