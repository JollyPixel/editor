// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PeerInvite } from "#src/offline/peer/PeerInvite.ts";

describe("PeerInvite", () => {
  it("survives a round trip through the page fragment", () => {
    const invite = new PeerInvite(crypto.randomUUID(), "aZ_09-token");

    const url = invite.toUrl("http://localhost/map/?offline&target=map#old");
    const parsed = PeerInvite.fromHash(url.hash);

    assert.equal(url.search, "?offline&target=map");
    assert.deepEqual(parsed, invite);
  });

  const kMalformed: [string, string][] = [
    ["no fragment", ""],
    ["another fragment key", "#target=map"],
    ["a missing token", "#peer=host"],
    ["an extra part", "#peer=host.token.extra"],
    ["an empty host", "#peer=.token"],
    ["characters outside base64url", "#peer=host.to%20ken"]
  ];
  for (const [name, hash] of kMalformed) {
    it(`reads no invite from ${name}`, () => {
      assert.equal(PeerInvite.fromHash(hash), undefined);
    });
  }
});
