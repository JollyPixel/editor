// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { FakeNetwork } from "@jolly-pixel/network/testing";

// Import Internal Dependencies
import {
  clock,
  connect
} from "../helpers/listeners.ts";

describe("SoundCollaboration spatial preview", () => {
  test("hears the sound from where the driver placed it", async(t) => {
    const network = new FakeNetwork();
    const alice = await connect(network, "alice");
    const bob = await connect(network, "bob");
    clock(t, [alice, bob]);

    alice.collaboration.session.drive();
    alice.player.retune(alice.player.mode
      .withPlacement(alice.player.mode.placement.movedTo({
        x: 5,
        z: 1
      }))
      .withSpatial(true));
    alice.player.play();
    bob.collaboration.session.join();

    const { panner } = bob.context;
    assert.deepEqual(bob.context.spatialInput.outputs, [panner]);
    assert.deepEqual([panner.positionX.value, panner.positionZ.value], [5, 1]);
  });
});
