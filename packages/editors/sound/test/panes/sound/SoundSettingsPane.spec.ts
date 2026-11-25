// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { oggContentFromAudio } from "@jolly-pixel/asset.sound";
import type { SoundDocument } from "@jolly-pixel/asset.sound/client";
import { Systems } from "@jolly-pixel/ecs";
import type { Button } from "@jolly-pixel/ui/elements/button";
import type { NumberField } from "@jolly-pixel/ui/elements/number";
import { FakeNetwork } from "@jolly-pixel/network/testing";

// Import Internal Dependencies
import "#src/panes/sound/SoundSettingsPane.ts";
import type { SoundPlayer } from "#src/player/SoundPlayer.ts";
import { Chime } from "#src/seed/Chime.ts";
import { connect } from "../../helpers/listeners.ts";
import type { TestSoundAccess } from "../../helpers/soundAccess.ts";

async function mountPane(): Promise<{
  pane: HTMLElementTagNameMap["jolly-sound-settings"];
  sound: SoundDocument;
  player: SoundPlayer;
  access: TestSoundAccess;
}> {
  const listener = await connect(new FakeNetwork(), "alice");
  listener.document.load(await oggContentFromAudio(new Chime().waveFile()));
  const pane = document.createElement("jolly-sound-settings");
  pane.attach(listener.settings, listener.player, listener.collaboration);
  document.body.append(pane);
  await pane.updateComplete;

  return {
    pane,
    sound: listener.document,
    player: listener.player,
    access: listener.access
  };
}

function numberField(
  pane: HTMLElement,
  label: string
): NumberField | undefined {
  return [...pane.shadowRoot!.querySelectorAll("jolly-number")]
    .find((field) => field.label === label);
}

function headerToggle(
  pane: HTMLElement,
  tool: string
): Button {
  return pane.shadowRoot!.querySelector<Button>(
    `jolly-button[slot="actions"][data-tool="${tool}"]`
  )!;
}

describe("SoundSettingsPane", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("the folder header toggles switch the preview between settings and spatial rules", async() => {
    const { pane, player } = await mountPane();

    headerToggle(pane, "spatial").click();
    await pane.updateComplete;

    assert.equal(player.mode.spatial, true);
    assert.equal(headerToggle(pane, "apply-settings").pressed, true);

    headerToggle(pane, "apply-settings").click();
    await pane.updateComplete;

    assert.equal(player.mode.applySettings, false);
    assert.equal(headerToggle(pane, "spatial").pressed, false);
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

  test("makes every setting read-only once the member loses \"settings\"", async() => {
    const { pane, access } = await mountPane();

    access.viewOnly();
    await pane.updateComplete;

    const fields = [
      ...pane.shadowRoot!.querySelectorAll("jolly-number, jolly-select, jolly-checkbox")
    ];
    assert.ok(fields.length > 0);
    assert.deepEqual(
      fields.filter((field) => !field.hasAttribute("readonly")),
      []
    );
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
