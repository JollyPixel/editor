// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { Membership } from "#src/realm/Membership.ts";

describe("Membership", () => {
  test("isAdmin reads the admin role of an active membership only", () => {
    const request = Membership.request("realm", "a1", "admin");

    assert.equal(Membership.active("realm", "a1", "member").isAdmin, false);
    assert.equal(request.isAdmin, false);
    assert.equal(request.approved("admin").isAdmin, true);
  });

  test("transitions copy without touching the original", () => {
    const request = Membership.request("realm", "a1", "spectator");

    const approved = request.approved("member").withRole("admin");

    assert.deepEqual(approved, Membership.active("realm", "a1", "admin"));
    assert.deepEqual(
      [request.role, request.pending],
      ["spectator", true]
    );
  });
});
