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
  status: "active",
  avatarHash: null
});

describe("StoredAccount", () => {
  test("isAdmin reads the admin role of an active account only", () => {
    const pendingAdmin = new StoredAccount({
      ...kMember,
      role: "admin",
      status: "pending"
    });

    assert.equal(kMember.isAdmin, false);
    assert.equal(kMember.withRole("admin").isAdmin, true);
    assert.equal(pendingAdmin.isAdmin, false);
  });

  test("withRole and withAvatar copy without touching the original", () => {
    const changed = kMember.withRole("spectator").withAvatar("abc");

    assert.deepEqual(
      changed,
      new StoredAccount({
        id: "a1",
        username: "Alice",
        role: "spectator",
        status: "active",
        avatarHash: "abc"
      })
    );
    assert.equal(kMember.role, "member");
    assert.equal(kMember.avatarHash, null);
  });
});
