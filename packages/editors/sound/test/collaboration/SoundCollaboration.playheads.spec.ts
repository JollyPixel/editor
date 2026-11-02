// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { toPresencePeer } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { PlayheadTag } from "#src/collaboration/Playheads.ts";
import type { SoundPlayer } from "#src/player/SoundPlayer.ts";
import { FakeNetwork } from "../helpers/FakeNetwork.ts";
import {
  clock,
  connect,
  type Listener
} from "../helpers/listeners.ts";

function peerColor(
  listener: Listener
): string {
  return toPresencePeer(listener.room.asPeer()).color;
}

function expectedTag(
  listener: Listener
): PlayheadTag {
  return {
    key: listener.room.clientId,
    name: listener.room.clientId,
    color: peerColor(listener)
  };
}

function bars(
  listener: Listener
): Array<{ clientId: string; tags: string[]; }> {
  return listener.collaboration.playheads().map((playhead) => {
    return {
      clientId: playhead.clientId,
      tags: playhead.tags.map((tag) => tag.key)
    };
  });
}

describe("SoundCollaboration playheads", () => {
  test("shows each peer's playhead in their color and name while they play", async(t) => {
    const network = new FakeNetwork();
    const alice = await connect(network, "alice");
    const bob = await connect(network, "bob");
    const advance = clock(t, [alice, bob]);

    alice.player.play();
    advance(500);

    const expected = [
      {
        clientId: "alice",
        color: peerColor(alice),
        position: 0.25,
        tags: [expectedTag(alice)]
      }
    ];
    assert.deepEqual(bob.collaboration.playheads(), expected);
    assert.deepEqual(alice.collaboration.playheads(), expected);
  });

  test("draws listeners on the driver's playhead under the driver's name until they leave", async(t) => {
    const network = new FakeNetwork();
    const alice = await connect(network, "alice");
    const bob = await connect(network, "bob");
    const carol = await connect(network, "carol");
    const advance = clock(t, [alice, bob, carol]);

    alice.collaboration.drive();
    alice.player.play();
    advance(500);
    bob.collaboration.listen();
    carol.collaboration.listen();
    advance(250);

    assert.deepEqual(bars(bob), [
      {
        clientId: "alice",
        tags: ["alice", "bob", "carol"]
      }
    ]);

    carol.collaboration.leave();

    assert.deepEqual(bars(alice), [
      {
        clientId: "carol",
        tags: ["carol"]
      },
      {
        clientId: "alice",
        tags: ["alice", "bob"]
      }
    ]);
  });

  test("moves a peer's playhead back to their audio once it leaves a suspended start", async(t) => {
    const network = new FakeNetwork();
    const alice = await connect(network, "alice");
    const bob = await connect(network, "bob");
    const advance = clock(t, [alice, bob]);
    alice.context.state = "suspended";

    alice.player.play();
    advance(300);
    alice.context.start();

    assert.deepEqual(
      bob.collaboration.playheads().map((playhead) => playhead.position),
      [0]
    );
  });

  test("draws the local playhead without a peer color or name while alone", async(t) => {
    const network = new FakeNetwork();
    const alice = await connect(network, "alice");
    const advance = clock(t, [alice]);

    alice.player.play();
    advance(500);

    assert.deepEqual(alice.collaboration.playheads(), [
      {
        clientId: "alice",
        color: null,
        position: 0.25,
        tags: []
      }
    ]);
  });

  for (const { loop, outcome, expected } of [
    {
      loop: false,
      outcome: "hides a remote playhead past the end of a sound without loop",
      expected: []
    },
    {
      loop: true,
      outcome: "wraps a remote playhead past the end of a sound that loops",
      expected: [0.25]
    }
  ]) {
    test(outcome, async(t) => {
      const network = new FakeNetwork();
      const alice = await connect(network, "alice");
      const bob = await connect(network, "bob");
      const advance = clock(t, [alice, bob]);

      alice.player.retune(alice.player.mode.withLoop(loop));
      alice.player.play();
      advance(2_500);

      assert.deepEqual(
        bob.collaboration.playheads().map((playhead) => playhead.position),
        expected
      );
    });
  }

  for (const { direction, steer, expected } of [
    {
      direction: "faster",
      steer: (player: SoundPlayer) => {
        player.retune(player.mode.withSpeed(2));
      },
      expected: [0.5]
    },
    {
      direction: "backwards",
      steer: (player: SoundPlayer) => {
        player.retune(player.mode.withReversed(true));
      },
      expected: [0.75]
    }
  ]) {
    test(`moves a remote playhead ${direction} at the peer's speed`, async(t) => {
      const network = new FakeNetwork();
      const alice = await connect(network, "alice");
      const bob = await connect(network, "bob");
      const advance = clock(t, [alice, bob]);

      steer(alice.player);
      alice.player.play();
      advance(500);

      assert.deepEqual(
        bob.collaboration.playheads().map((playhead) => playhead.position),
        expected
      );
    });
  }
});
