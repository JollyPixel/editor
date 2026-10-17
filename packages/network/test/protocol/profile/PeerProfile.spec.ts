// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  GUEST_USERNAME,
  parsePeerProfile,
  type PeerProfileMetadata
} from "#src/protocol/profile/PeerProfile.ts";

function parseAvatar(
  avatar: unknown
): string | undefined {
  return parsePeerProfile({ avatar }).avatar;
}

describe("parsePeerProfile", () => {
  test("reads every field a profile writer publishes", () => {
    const written: PeerProfileMetadata = {
      username: "Ada",
      peerId: "peer-1",
      avatar: "/api/accounts/a/avatar?v=1",
      via: "link"
    };

    assert.deepEqual(parsePeerProfile(written), written);
  });

  test("names a peer without a username as a guest", () => {
    assert.deepEqual(parsePeerProfile(undefined), { username: GUEST_USERNAME });
    assert.equal(parsePeerProfile({ username: 42 }).username, GUEST_USERNAME);
  });

  test("drops a malformed field and keeps the others", () => {
    const profile = parsePeerProfile({
      username: "Ada",
      peerId: 7,
      via: false
    });

    assert.equal(profile.username, "Ada");
    assert.equal(profile.peerId, undefined);
    assert.equal(profile.via, undefined);
  });

  test("keeps an avatar only when it is a same-origin path", () => {
    assert.equal(parseAvatar("/api/accounts/a/avatar?v=1"), "/api/accounts/a/avatar?v=1");
    assert.equal(parseAvatar(null), undefined);
    assert.equal(parseAvatar("https://example.com/a.png"), undefined);
    assert.equal(parseAvatar("//example.com/a.png"), undefined);
    assert.equal(parseAvatar("/\\example.com/a.png"), undefined);
    assert.equal(parseAvatar("data:image/png;base64,AA"), undefined);
  });
});
