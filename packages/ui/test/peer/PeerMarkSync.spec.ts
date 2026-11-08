// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import {
  PeerMarks,
  type PeerMark
} from "../../src/peer/PeerMarks.ts";
import { PeerMarkSync } from "../../src/peer/PeerMarkSync.ts";

type Call = ["hold", string, string] | ["release", string];

function marks(
  entries: Array<[clientId: string, key: string]>
): PeerMarks<string> {
  return new PeerMarks(
    entries.map(([clientId, key]): PeerMark<string> => [
      {
        clientId,
        displayName: clientId,
        color: `#${clientId}`
      },
      key
    ])
  );
}

function recordingSync(): {
  sync: PeerMarkSync<string>;
  calls: Call[];
} {
  const calls: Call[] = [];
  const sync = new PeerMarkSync<string>({
    hold: (peer, key) => void calls.push(["hold", peer.clientId, key]),
    release: (clientId) => void calls.push(["release", clientId])
  });

  return {
    sync,
    calls
  };
}

describe("PeerMarkSync", () => {
  it("holds every peer on the first apply", () => {
    const { sync, calls } = recordingSync();

    sync.apply(marks([["bob", "torso"], ["eve", "torso"]]));

    assert.deepEqual(calls, [["hold", "bob", "torso"], ["hold", "eve", "torso"]]);
  });

  it("holds a peer that moved without releasing them first", () => {
    const { sync, calls } = recordingSync();
    sync.apply(marks([["bob", "torso"]]));
    calls.length = 0;

    sync.apply(marks([["bob", "head"]]));

    assert.deepEqual(calls, [["hold", "bob", "head"]]);
  });

  it("releases peers that let go and leaves unchanged peers alone", () => {
    const { sync, calls } = recordingSync();
    sync.apply(marks([["bob", "head"], ["eve", "torso"]]));
    calls.length = 0;

    sync.apply(marks([["eve", "torso"]]));

    assert.deepEqual(calls, [["release", "bob"]]);
  });
});
