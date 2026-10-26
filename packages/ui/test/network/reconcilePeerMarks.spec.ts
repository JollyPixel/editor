// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { reconcilePeerMarks } from "../../src/network/reconcilePeerMarks.ts";
import type { PresencePeer } from "../../src/peer/types.ts";

type Call = ["hold", string, string] | ["release", string];

function peerMarks(
  entries: Array<[key: string, clientId: string]>
): Map<string, PresencePeer[]> {
  const marks = new Map<string, PresencePeer[]>();
  for (const [key, clientId] of entries) {
    const peers = marks.get(key) ?? [];
    peers.push({
      clientId,
      displayName: clientId,
      color: "#ff0000"
    });
    marks.set(key, peers);
  }

  return marks;
}

function reconcile(
  marks: ReturnType<typeof peerMarks>,
  previous: ReadonlyMap<string, string>
): { next: Map<string, string>; calls: Call[]; } {
  const calls: Call[] = [];
  const next = reconcilePeerMarks(marks, previous, {
    hold: (peer, key) => void calls.push(["hold", peer.clientId, key]),
    release: (clientId) => void calls.push(["release", clientId])
  });

  return { next, calls };
}

describe("reconcilePeerMarks", () => {
  it("holds every peer on the first pass", () => {
    const { next, calls } = reconcile(
      peerMarks([["torso", "bob"], ["torso", "eve"]]),
      new Map()
    );

    assert.deepEqual(calls, [["hold", "bob", "torso"], ["hold", "eve", "torso"]]);
    assert.deepEqual([...next], [["bob", "torso"], ["eve", "torso"]]);
  });

  it("holds a peer that moved without releasing them first", () => {
    const { calls } = reconcile(
      peerMarks([["head", "bob"]]),
      new Map([["bob", "torso"]])
    );

    assert.deepEqual(calls, [["hold", "bob", "head"]]);
  });

  it("releases peers that let go and leaves unchanged peers alone", () => {
    const { next, calls } = reconcile(
      peerMarks([["torso", "eve"]]),
      new Map([["bob", "head"], ["eve", "torso"]])
    );

    assert.deepEqual(calls, [["release", "bob"]]);
    assert.deepEqual([...next], [["eve", "torso"]]);
  });
});
