// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test,
  type TestContext
} from "node:test";

// Import Third-party Dependencies
import { FakeNetwork } from "@jolly-pixel/network/testing";

// Import Internal Dependencies
import { DriveSession } from "../../src/network/DriveSession.ts";

interface Seat {
  session: DriveSession;
  joins: Array<string | null>;
  driverChanges: () => number;
}

function seat(
  t: TestContext,
  network: FakeNetwork,
  clientId: string
): Seat {
  const joins: Array<string | null> = [];
  let driverChanges = 0;
  const session = new DriveSession({
    room: network.connect(clientId),
    publish: () => undefined,
    onJoinChange: (driverId) => joins.push(driverId),
    onDriverChange: () => driverChanges++
  });
  t.after(() => session.dispose());

  return {
    session,
    joins,
    driverChanges: () => driverChanges
  };
}

describe("DriveSession", () => {
  test("is alone until another peer connects, then open until one drives", (t) => {
    const network = new FakeNetwork();
    const alice = seat(t, network, "alice");

    assert.equal(alice.session.stance.kind, "alone");

    const bob = seat(t, network, "bob");

    assert.equal(alice.session.stance.kind, "open");
    assert.equal(bob.session.stance.kind, "open");
  });

  test("follows the driver and badges them in the peer list", (t) => {
    const network = new FakeNetwork();
    const alice = seat(t, network, "alice");
    const bob = seat(t, network, "bob");

    alice.session.drive();

    assert.equal(alice.session.stance.kind, "driving");
    assert.equal(bob.session.driverId, "alice");
    assert.equal(bob.driverChanges(), 1);
    assert.deepEqual(
      bob.session.peers.map((peer) => [peer.clientId, peer.badge]),
      [["bob", undefined], ["alice", "driving"]]
    );

    const { stance } = bob.session;
    assert.equal(stance.kind, "following");
    assert.equal(stance.driver.clientId, "alice");
    assert.equal(stance.joined, false);
  });

  test("joins the driver and leaves once, reporting each change", (t) => {
    const network = new FakeNetwork();
    const alice = seat(t, network, "alice");
    const bob = seat(t, network, "bob");
    alice.session.drive();

    bob.session.join();
    const { stance } = bob.session;
    bob.session.leave();
    bob.session.leave();

    assert.equal(stance.kind === "following" && stance.joined, true);
    assert.deepEqual(bob.joins, ["alice", null]);
    assert.equal(bob.session.joinedId, null);
  });

  test("joins nobody while no peer drives", (t) => {
    const network = new FakeNetwork();
    seat(t, network, "alice");
    const bob = seat(t, network, "bob");

    bob.session.join();

    assert.deepEqual(bob.joins, []);
    assert.equal(bob.session.joinedId, null);
  });

  test("leaves the driver once they release the claim", (t) => {
    const network = new FakeNetwork();
    const alice = seat(t, network, "alice");
    const bob = seat(t, network, "bob");
    alice.session.drive();
    bob.session.join();

    alice.session.release();

    assert.deepEqual(bob.joins, ["alice", null]);
    assert.equal(bob.driverChanges(), 2);
    assert.equal(bob.session.stance.kind, "open");
  });
});
