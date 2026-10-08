// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AccountRoles } from "#src/node.ts";

describe("AccountRoles", () => {
  test("always holds the admin role", () => {
    const roles = new AccountRoles({
      roles: ["member"],
      defaultRole: "member"
    });

    assert.deepEqual([...roles], ["admin", "member"]);
  });

  test("throws when the default role is not a role", () => {
    assert.throws(
      () => new AccountRoles({
        roles: ["member"],
        defaultRole: "spectator"
      }),
      RangeError
    );
  });

  test("falls back to the default role for a role it does not hold", () => {
    const roles = new AccountRoles({
      roles: [
        "member",
        "spectator"
      ],
      defaultRole: "spectator"
    });

    assert.equal(roles.effective("member"), "member");
    assert.equal(roles.effective("editor"), "spectator");
  });
});
