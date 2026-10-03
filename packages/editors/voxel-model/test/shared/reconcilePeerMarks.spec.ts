// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { reconcilePeerMarks } from "#src/shared/reconcilePeerMarks.ts";

type Call = ["hold", string, string] | ["release", string];

function peerMarks(
  entries: Array<[uuid: string, clientId: string]>
): Map<string, { clientId: string; displayName: string; color: string; }[]> {
  const marks = new Map<string, { clientId: string; displayName: string; color: string; }[]>();
  for (const [uuid, clientId] of entries) {
    const peers = marks.get(uuid) ?? [];
    peers.push({ clientId, displayName: clientId, color: "#ff0000" });
    marks.set(uuid, peers);
  }

  return marks;
}

function reconcile(
  marks: ReturnType<typeof peerMarks>,
  previous: ReadonlyMap<string, string>
): { next: Map<string, string>; calls: Call[]; } {
  const calls: Call[] = [];
  const next = reconcilePeerMarks(marks, previous, {
    hold: (peer, uuid) => void calls.push(["hold", peer.clientId, uuid]),
    release: (clientId) => void calls.push(["release", clientId])
  });

  return { next, calls };
}

describe("reconcilePeerMarks", () => {
  test("holds every peer on the first pass", () => {
    const { next, calls } = reconcile(
      peerMarks([["torso", "bob"], ["torso", "eve"]]),
      new Map()
    );

    assert.deepEqual(calls, [["hold", "bob", "torso"], ["hold", "eve", "torso"]]);
    assert.deepEqual([...next], [["bob", "torso"], ["eve", "torso"]]);
  });

  test("holds a peer that moved without releasing them first", () => {
    const { calls } = reconcile(
      peerMarks([["head", "bob"]]),
      new Map([["bob", "torso"]])
    );

    assert.deepEqual(calls, [["hold", "bob", "head"]]);
  });

  test("releases peers that let go and leaves unchanged peers alone", () => {
    const { next, calls } = reconcile(
      peerMarks([["torso", "eve"]]),
      new Map([["bob", "head"], ["eve", "torso"]])
    );

    assert.deepEqual(calls, [["release", "bob"]]);
    assert.deepEqual([...next], [["eve", "torso"]]);
  });
});
