// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { FakeNetwork } from "@jolly-pixel/network/testing";

// Import Internal Dependencies
import "#src/panes/ModelAnimate.ts";
import {
  clock,
  connect,
  type Viewer
} from "../helpers/peers.ts";

async function mountAnimate(
  viewer: Viewer
) {
  const pane = document.createElement("jolly-model-animate");
  pane.attach(viewer.player, viewer.collaboration);
  document.body.append(pane);
  await pane.updateComplete;

  return pane;
}

describe("ModelAnimate", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("lists the clips in one select and selects the picked clip", async(t) => {
    const viewer = connect(new FakeNetwork(), "alice");
    clock(t, [viewer]);
    t.after(() => viewer.collaboration.dispose());
    const pane = await mountAnimate(viewer);
    const select = pane.shadowRoot!.querySelector("jolly-select")!;

    assert.deepEqual(
      select.options.map((option) => option.label),
      ["spin (1.00 s)", "lift (2.00 s)"]
    );

    select.dispatchEvent(new CustomEvent("jolly-change", {
      detail: { value: "lift" }
    }));

    assert.equal(viewer.player.selected, "lift");
  });

  test("names the driver and watches along once asked", async(t) => {
    const network = new FakeNetwork();
    const alice = connect(network, "alice");
    const bob = connect(network, "bob");
    clock(t, [alice, bob]);
    t.after(() => {
      alice.collaboration.dispose();
      bob.collaboration.dispose();
    });
    alice.collaboration.session.drive();
    alice.collaboration.toggle();
    const pane = await mountAnimate(bob);
    const driver = pane.shadowRoot!.querySelector(".driver")!;

    assert.match(driver.textContent!, /alice\s+is driving/);
    assert.equal(pane.shadowRoot!.querySelector("[data-tool=drive]"), null);

    driver.querySelector("[data-tool=watch]")!.dispatchEvent(new Event("click"));

    assert.equal(bob.player.playing, true);
  });
});
