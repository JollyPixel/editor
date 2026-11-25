// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { FakeNetwork } from "@jolly-pixel/network/testing";

// Import Internal Dependencies
import type { ModelCollaboration } from "#src/collaboration/ModelCollaboration.ts";
import {
  clock,
  connect,
  type Viewer
} from "../helpers/peers.ts";
import {
  liftClip,
  rounded,
  spinClip
} from "../helpers/player.ts";

function watching(
  viewer: Viewer
): boolean {
  const { stance } = viewer.collaboration.session;

  return stance.kind === "following" && stance.joined;
}

function playback(
  viewer: Viewer
) {
  const { player } = viewer;

  return {
    clip: player.selected,
    state: player.state,
    time: rounded(player.time),
    loop: player.loop,
    speed: player.speed
  };
}

function watchParty(
  t: TestContext
) {
  const network = new FakeNetwork();
  const alice = connect(network, "alice");
  const bob = connect(network, "bob");
  const advance = clock(t, [alice, bob]);
  t.after(() => {
    alice.collaboration.dispose();
    bob.collaboration.dispose();
  });
  alice.collaboration.session.drive();

  return {
    advance,
    alice,
    bob
  };
}

describe("ModelCollaboration", () => {
  test("leaves the other peers' playback alone until they watch", (t) => {
    const { alice, bob } = watchParty(t);
    alice.collaboration.toggle();

    assert.equal(watching(bob), false);
    assert.equal(bob.player.state, "stopped");
  });

  test("plays the driver's clip from their position at their speed once watching", (t) => {
    const { alice, bob, advance } = watchParty(t);
    alice.collaboration.select("lift");
    alice.collaboration.changeSpeed(2);
    alice.collaboration.toggleLoop();
    alice.collaboration.toggle();
    advance(400);

    bob.collaboration.session.join();

    assert.deepEqual(playback(bob), {
      clip: "lift",
      state: "playing",
      time: 0.8,
      loop: false,
      speed: 2
    });
  });

  test("picks up a looping clip where the driver's loop wrapped", (t) => {
    const { alice, bob, advance } = watchParty(t);
    alice.collaboration.toggle();
    advance(1_500);

    bob.collaboration.session.join();

    assert.equal(rounded(bob.player.time), 0.5);
  });

  test("follows the driver's pause and scrub while watching", (t) => {
    const { alice, bob, advance } = watchParty(t);
    alice.collaboration.toggle();
    bob.collaboration.session.join();
    advance(250);

    alice.collaboration.toggle();

    assert.deepEqual(
      [bob.player.state, rounded(bob.player.time)],
      ["paused", 0.25]
    );

    alice.collaboration.seek(0.75);

    assert.equal(bob.player.time, 0.75);
  });

  test("pulls a watcher that drifted back to the driver on the next heartbeat", (t) => {
    const { alice, bob, advance } = watchParty(t);
    alice.collaboration.select("lift");
    alice.collaboration.changeSpeed(0.5);
    alice.collaboration.toggle();
    bob.collaboration.session.join();
    bob.player.update(0.3);

    advance(2_000);

    assert.equal(rounded(bob.player.time), 1);
  });

  const kWatcherControls: Record<string, (collaboration: ModelCollaboration) => void> = {
    "play state": (collaboration) => collaboration.toggle(),
    stop: (collaboration) => collaboration.stop(),
    time: (collaboration) => collaboration.seek(0.1),
    clip: (collaboration) => collaboration.select("spin"),
    loop: (collaboration) => collaboration.toggleLoop(),
    speed: (collaboration) => collaboration.changeSpeed(0.5)
  };
  for (const [control, change] of Object.entries(kWatcherControls)) {
    test(`stops watching once the watcher changes the ${control}`, (t) => {
      const { alice, bob } = watchParty(t);
      alice.collaboration.select("lift");
      alice.collaboration.toggle();
      bob.collaboration.session.join();

      change(bob.collaboration);
      alice.collaboration.seek(1.5);

      assert.equal(watching(bob), false);
      assert.notEqual(bob.player.time, 1.5);
    });
  }

  const kDriverExits: Record<string, (viewer: Viewer) => void> = {
    "releases the wheel": (viewer) => viewer.collaboration.session.release(),
    leaves: (viewer) => viewer.room.leave()
  };
  for (const [reason, exit] of Object.entries(kDriverExits)) {
    test(`stops watching but keeps playing when the driver ${reason}`, (t) => {
      const { alice, bob } = watchParty(t);
      alice.collaboration.toggle();
      bob.collaboration.session.join();

      exit(alice);

      assert.equal(watching(bob), false);
      assert.equal(bob.player.playing, true);
    });
  }

  test("goes back to the driver's clip once its own model reloads", (t) => {
    const { alice, bob, advance } = watchParty(t);
    alice.collaboration.select("lift");
    alice.collaboration.toggle();
    bob.collaboration.session.join();
    advance(500);

    bob.player.load(new THREE.Object3D(), [spinClip(), liftClip()]);

    assert.deepEqual(
      [bob.player.selected, bob.player.state, rounded(bob.player.time)],
      ["lift", "playing", 0.5]
    );
  });
});
