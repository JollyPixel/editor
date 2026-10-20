// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { BroadcastSignaling } from "#src/offline/peer/signaling/BroadcastSignaling.ts";
import type { PeerSignalMessage } from "#src/offline/peer/signaling/PeerSignaling.ts";

function nextMessage(
  signaling: BroadcastSignaling
): Promise<PeerSignalMessage> {
  return new Promise((resolve) => {
    const unsubscribe = signaling.subscribe((message) => {
      unsubscribe();
      resolve(message);
    });
  });
}

describe("BroadcastSignaling", () => {
  it("delivers a signal to its addressee only, stamped with the sender", async() => {
    const guest = new BroadcastSignaling();
    const host = new BroadcastSignaling();
    const bystander = new BroadcastSignaling();
    const toHost = nextMessage(host);
    const toBystander = nextMessage(bystander);

    guest.send({
      to: host.id,
      session: "s1",
      signal: {
        type: "offer",
        sdp: "v=0"
      }
    });
    guest.send({
      to: bystander.id,
      session: "s2",
      signal: {
        type: "answer",
        sdp: "v=0"
      }
    });

    try {
      assert.deepEqual(await toHost, {
        from: guest.id,
        to: host.id,
        session: "s1",
        signal: {
          type: "offer",
          sdp: "v=0"
        }
      });
      assert.equal((await toBystander).session, "s2");
    }
    finally {
      guest.close();
      host.close();
      bystander.close();
    }
  });
});
