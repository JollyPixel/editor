// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import "#src/panes/spatial/SpatialPad.ts";
import { FakeNetwork } from "../../helpers/FakeNetwork.ts";
import { connect } from "../../helpers/listeners.ts";

describe("SpatialPad", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("moves the sound with the arrow keys", async() => {
    const { player, collaboration, settings } = await connect(new FakeNetwork(), "alice");
    player.retune(player.mode.withSpatial(true));
    const pad = document.createElement("jolly-sound-spatial");
    pad.attach(player, collaboration, settings);
    document.body.append(pad);
    await pad.updateComplete;

    pad.shadowRoot!.querySelector("svg")!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight" })
    );

    const { placement } = player.mode;
    assert.ok(placement.x > 0);
    assert.equal(placement.z, -2);
  });

  test("sets the motion picked in the Motion menu", async() => {
    const { player, collaboration, settings } = await connect(new FakeNetwork(), "alice");
    const pad = document.createElement("jolly-sound-spatial");
    pad.attach(player, collaboration, settings);
    document.body.append(pad);
    await pad.updateComplete;

    pad.shadowRoot!.querySelector("jolly-select")!.dispatchEvent(
      new CustomEvent("jolly-change", {
        detail: { value: "orbit" }
      })
    );

    assert.equal(player.mode.placement.motion, "orbit");
  });
});
