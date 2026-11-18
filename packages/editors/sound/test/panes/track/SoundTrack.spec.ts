// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { oggContentFromAudio } from "@jolly-pixel/asset.sound";

// Import Internal Dependencies
import "#src/panes/track/SoundTrack.ts";
import { Chime } from "#src/seed/Chime.ts";
import { FakeNetwork } from "../../helpers/FakeNetwork.ts";
import { connect } from "../../helpers/listeners.ts";

describe("SoundTrack volume", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("shows and edits the settings volume while the settings are applied", async() => {
    const listener = await connect(new FakeNetwork(), "alice");
    const { player, settings } = listener;
    listener.document.load(await oggContentFromAudio(new Chime().waveFile()));
    const track = document.createElement("jolly-sound-track");
    track.attach(player, listener.collaboration, settings);
    document.body.append(track);
    player.retune(player.mode.withApplySettings(true));
    await track.updateComplete;
    const slider = track.shadowRoot!.querySelector("jolly-slider")!;

    assert.equal(slider.value, 100);

    slider.dispatchEvent(new CustomEvent("jolly-change", {
      detail: { value: 40 }
    }));
    await track.updateComplete;

    assert.equal(listener.document.settings.volume, 0.4);
    assert.equal(slider.value, 40);
    assert.equal(player.volume.toPercent(), 50);
  });
});
