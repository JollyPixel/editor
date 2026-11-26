// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { oggContentFromAudio } from "@jolly-pixel/asset.sound";
import { SoundDocument } from "@jolly-pixel/asset.sound/client";

// Import Internal Dependencies
import { Chime } from "#src/seed/Chime.ts";
import { LiveSettings } from "#src/settings/LiveSettings.ts";
import { TestSoundAccess } from "../helpers/soundAccess.ts";

async function createSettings() {
  const document = new SoundDocument();
  document.load(await oggContentFromAudio(new Chime().waveFile()));
  const access = new TestSoundAccess();

  return {
    document,
    access,
    settings: new LiveSettings(document, access)
  };
}

describe("LiveSettings", () => {
  test("neither previews nor saves a change without \"settings\", then saves it with it", async() => {
    const { document, access, settings } = await createSettings();
    const { volume } = document.settings;

    access.viewOnly();
    settings.preview({ volume: 0.25 });
    settings.commit({ volume: 0.25 });

    assert.strictEqual(document.settings.volume, volume);
    assert.strictEqual(settings.current.volume, volume);

    access.grant("settings");
    settings.commit({ volume: 0.25 });

    assert.strictEqual(document.settings.volume, 0.25);
  });

  test("drops a running preview when the member loses \"settings\"", async() => {
    const { document, access, settings } = await createSettings();
    const { volume } = document.settings;
    settings.preview({ volume: 0.25 });

    access.viewOnly();

    assert.strictEqual(settings.current.volume, volume);
  });
});
