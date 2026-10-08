// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { StoredAccount } from "#src/node.ts";

// CONSTANTS
const kMember = new StoredAccount({
  id: "a1",
  username: "Alice",
  role: "member",
  avatarHash: null
});

describe("StoredAccount", () => {
  test("isAdmin reads the admin role only", () => {
    assert.equal(kMember.isAdmin, false);
    assert.equal(kMember.withRole("admin").isAdmin, true);
  });

  test("withRole and withAvatar copy without touching the original", () => {
    const changed = kMember.withRole("spectator").withAvatar("abc");

    assert.deepEqual(
      changed,
      new StoredAccount({
        id: "a1",
        username: "Alice",
        role: "spectator",
        avatarHash: "abc"
      })
    );
    assert.equal(kMember.role, "member");
    assert.equal(kMember.avatarHash, null);
  });
});
