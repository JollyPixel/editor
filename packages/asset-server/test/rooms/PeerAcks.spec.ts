// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PeerAcks } from "#src/rooms/PeerAcks.ts";

describe("PeerAcks", () => {
  test("acknowledges only the clients that sent a seq", () => {
    const acks = new PeerAcks();
    acks.record("alice", 2);
    acks.record("bob", undefined);

    assert.deepEqual(acks.of(["alice", "bob"]), { acks: { alice: 2 } });
    assert.deepEqual(acks.of(["bob"]), {});
  });

  test("a departed client is acknowledged on resume only", () => {
    const acks = new PeerAcks();
    acks.record("alice", 3);
    acks.depart("alice");

    assert.deepEqual(acks.ofEveryone(), {});
    assert.deepEqual(acks.resumedBy("alice"), { acks: { alice: 3 } });
  });

  test("forgets the oldest departure past 256", () => {
    const acks = new PeerAcks();
    for (let index = 0; index <= 256; index++) {
      acks.record(`client-${index}`, index);
      acks.depart(`client-${index}`);
    }

    assert.deepEqual(acks.resumedBy("client-0"), {});
    assert.deepEqual(acks.resumedBy("client-256"), {
      acks: { "client-256": 256 }
    });
  });
});
