// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { oggContentFromAudio } from "@jolly-pixel/asset.sound";
import { SoundDocument } from "@jolly-pixel/asset.sound/client";
import { Systems } from "@jolly-pixel/engine/core";
import type { NumberField } from "@jolly-pixel/ui/elements/number";

// Import Internal Dependencies
import "#src/panes/sound/SoundSettingsPane.ts";
import { Chime } from "#src/seed/Chime.ts";
import { LiveSettings } from "#src/settings/LiveSettings.ts";

async function mountPane(): Promise<{
  pane: HTMLElementTagNameMap["jolly-sound-settings"];
  sound: SoundDocument;
}> {
  const sound = new SoundDocument();
  sound.load(await oggContentFromAudio(new Chime().waveFile()));
  const pane = document.createElement("jolly-sound-settings");
  pane.attach(new LiveSettings(sound));
  document.body.append(pane);
  await pane.updateComplete;

  return {
    pane,
    sound
  };
}

function numberField(
  pane: HTMLElement,
  label: string
): NumberField | undefined {
  return [...pane.shadowRoot!.querySelectorAll("jolly-number")]
    .find((field) => field.label === label);
}

describe("SoundSettingsPane", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("shows Max distance only for the linear falloff", async() => {
    const { pane, sound } = await mountPane();
    assert.equal(numberField(pane, "Max distance"), undefined);

    sound.change({
      spatial: {
        ...sound.settings.spatial,
        distanceModel: "linear"
      }
    });
    await pane.updateComplete;

    assert.notEqual(numberField(pane, "Max distance"), undefined);
  });

  test("shows each scrub step and writes the document only on release", async() => {
    const { pane, sound } = await mountPane();
    const volume = numberField(pane, "Volume")!;

    volume.dispatchEvent(new CustomEvent("jolly-input", {
      detail: { value: 0.4 }
    }));
    await pane.updateComplete;

    assert.equal(volume.value, 0.4);
    assert.equal(sound.settings.volume, 1);

    volume.dispatchEvent(new CustomEvent("jolly-change", {
      detail: { value: 0.3 }
    }));
    await pane.updateComplete;

    assert.equal(volume.value, 0.3);
    assert.equal(sound.settings.volume, 0.3);
  });

  test("reverting a spatial field restores the engine default", async() => {
    const { pane, sound } = await mountPane();
    sound.change({
      spatial: {
        ...sound.settings.spatial,
        refDistance: 3,
        rolloffFactor: 4
      }
    });
    await pane.updateComplete;
    const rolloff = numberField(pane, "Rolloff")!;
    await rolloff.updateComplete;

    rolloff.shadowRoot!.querySelector<HTMLButtonElement>(".revert")!.click();

    assert.equal(
      sound.settings.spatial.rolloffFactor,
      Systems.SOUND_SPATIAL_DEFAULTS.rolloffFactor
    );
    assert.equal(sound.settings.spatial.refDistance, 3);
  });
});
