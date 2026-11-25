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
  connect,
  type Listener
} from "../helpers/listeners.ts";

// CONSTANTS
const kOtherOggBytes = new Uint8Array([0x4F, 0x67, 0x67, 0x53, 0x00]);

function followed(
  listener: Listener
): { driverId: string; listening: boolean; } | null {
  const { stance } = listener.collaboration.session;

  return stance.kind === "following" ?
    {
      driverId: stance.driver.clientId,
      listening: stance.joined
    } :
    null;
}

describe("SoundCollaboration", () => {
  test("plays along with the driver from their position once listening", async(t) => {
    const network = new FakeNetwork();
    const alice = await connect(network, "alice");
    const bob = await connect(network, "bob");
    const advance = clock(t, [alice, bob]);

    alice.collaboration.session.drive();
    alice.player.play();
    advance(500);
    bob.collaboration.session.join();

    assert.equal(bob.player.elapsed, 0.5);

    advance(250);
    alice.player.retune(alice.player.mode.withLoop(true));

    assert.equal(bob.player.mode.loop, true);
    assert.equal(bob.context.sources.length, 1);

    alice.collaboration.retune(alice.player.mode.withSpeed(2));
    alice.collaboration.retune(alice.player.mode.withReversed(true));

    assert.deepEqual(bob.player.mode.toJSON(), {
      ...alice.player.mode.toJSON(),
      loop: true,
      reversed: true,
      speed: 2
    });

    alice.collaboration.seek(0.25);

    assert.equal(bob.player.elapsed, 0.5);

    alice.player.pause();

    assert.equal(bob.player.playing, false);
    assert.equal(followed(bob)?.listening, true);
  });

  test("plays along at the random pitch the driver rolled", async(t) => {
    const network = new FakeNetwork();
    const alice = await connect(network, "alice");
    const bob = await connect(network, "bob");
    clock(t, [alice, bob]);
    const random = t.mock.method(Math, "random", () => 1);
    for (const { settings } of [alice, bob]) {
      settings.preview({ pitchVariation: 0.4 });
    }

    alice.collaboration.session.drive();
    alice.player.retune(alice.player.mode.withApplySettings(true));
    alice.player.play();
    random.mock.mockImplementation(() => 0);
    bob.collaboration.session.join();

    assert.equal(bob.context.sources[0].playbackRate.value, 1.4);
  });

  test("listens along with a driver who took the wheel before it joined", async(t) => {
    const network = new FakeNetwork();
    const alice = await connect(network, "alice");
    const advance = clock(t, [alice]);

    alice.collaboration.session.drive();
    alice.player.play();
    advance(500);
    const bob = await connect(network, "bob");
    bob.collaboration.session.join();

    assert.deepEqual(followed(bob), {
      driverId: "alice",
      listening: true
    });
    assert.equal(bob.player.elapsed, 0.5);
  });

  test("catches up with the driver once its suspended audio starts", async(t) => {
    const network = new FakeNetwork();
    const alice = await connect(network, "alice");
    const bob = await connect(network, "bob");
    const advance = clock(t, [alice, bob]);
    bob.context.state = "suspended";

    alice.collaboration.session.drive();
    alice.player.play();
    bob.collaboration.session.join();
    advance(300);
    bob.context.start();

    assert.equal(bob.player.elapsed, 0.3);
  });

  test("pulls a listener whose audio drifted back to the driver's position", async(t) => {
    const network = new FakeNetwork();
    const alice = await connect(network, "alice");
    const bob = await connect(network, "bob");
    const advance = clock(t, [alice, bob]);

    alice.collaboration.session.drive();
    alice.player.retune(alice.player.mode.withLoop(true));
    alice.player.play();
    bob.collaboration.session.join();
    advance(1_500);
    bob.context.currentTime -= 0.1;
    advance(500);

    assert.equal(bob.player.elapsed, alice.player.elapsed);
  });

  test("plays along with the driver once its own sound finishes loading", async(t) => {
    const network = new FakeNetwork();
    const alice = await connect(network, "alice");
    const bob = await connect(network, "bob");
    const advance = clock(t, [alice, bob]);

    alice.collaboration.session.drive();
    alice.player.play();
    bob.collaboration.session.join();
    advance(500);
    const reloaded = new Promise<void>((resolve) => {
      const unsubscribe = bob.player.subscribe("sound", () => {
        unsubscribe();
        resolve();
      });
    });
    bob.document.load(kOtherOggBytes);
    await reloaded;

    assert.equal(bob.player.elapsed, 0.5);
  });

  for (const { control, use, applied } of [
    {
      control: "loop",
      use: (listener: Listener) => listener.collaboration.retune(
        listener.player.mode.withLoop(true)
      ),
      applied: (listener: Listener) => listener.player.mode.loop
    },
    {
      control: "direction",
      use: (listener: Listener) => listener.collaboration.retune(
        listener.player.mode.withReversed(true)
      ),
      applied: (listener: Listener) => listener.player.mode.reversed
    },
    {
      control: "speed",
      use: (listener: Listener) => listener.collaboration.retune(
        listener.player.mode.withSpeed(2)
      ),
      applied: (listener: Listener) => listener.player.mode.speed === 2
    },
    {
      control: "position",
      use: (listener: Listener) => listener.collaboration.seek(0.5),
      applied: (listener: Listener) => listener.player.elapsed === 1
    }
  ]) {
    test(`stops listening along once the listener changes the ${control}`, async(t) => {
      const network = new FakeNetwork();
      const alice = await connect(network, "alice");
      const bob = await connect(network, "bob");
      clock(t, [alice, bob]);

      alice.collaboration.session.drive();
      alice.player.play();
      bob.collaboration.session.join();
      use(bob);
      alice.player.pause();

      assert.equal(followed(bob)?.listening, false);
      assert.equal(applied(bob), true);
      assert.equal(bob.player.playing, true);
    });
  }

  for (const { reason, end } of [
    {
      reason: "lets go of the wheel",
      end: (driver: Listener) => driver.collaboration.session.release()
    },
    {
      reason: "leaves the room",
      end: (driver: Listener) => driver.room.leave()
    }
  ]) {
    test(`stops listening but keeps playing when the driver ${reason}`, async(t) => {
      const network = new FakeNetwork();
      const alice = await connect(network, "alice");
      const bob = await connect(network, "bob");
      clock(t, [alice, bob]);

      alice.collaboration.session.drive();
      alice.player.play();
      bob.collaboration.session.join();
      end(alice);

      assert.equal(followed(bob), null);
      assert.equal(bob.player.playing, true);
    });
  }

  test("plays once from a peer's position when picked, without following them", async(t) => {
    const network = new FakeNetwork();
    const alice = await connect(network, "alice");
    const bob = await connect(network, "bob");
    const advance = clock(t, [alice, bob]);

    alice.player.play();
    advance(500);
    bob.collaboration.listenTo("alice");
    alice.player.pause();

    assert.equal(bob.player.playing, true);
    assert.equal(bob.player.elapsed, 0.5);
  });

  test("withdraws its playback and wheel from peers when disposed", async(t) => {
    const network = new FakeNetwork();
    const alice = await connect(network, "alice");
    const bob = await connect(network, "bob");
    clock(t, [alice, bob]);

    alice.collaboration.session.drive();
    alice.player.play();
    alice.collaboration.dispose();

    assert.equal(followed(bob), null);
    assert.deepEqual(bob.collaboration.playheads(), []);
  });
});
