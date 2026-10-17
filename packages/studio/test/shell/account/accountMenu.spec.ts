// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import { accountMenu } from "../../../src/shell/account/accountMenu.ts";

function readHeader(
  account: Account
): unknown {
  return accountMenu(account)[0];
}

describe("accountMenu", () => {
  test("opens on a disabled header naming the owner with a crown", () => {
    assert.deepEqual(readHeader({
      id: "a1",
      username: "ada",
      role: "admin",
      owner: true
    }), {
      id: "account",
      label: "ada · Owner",
      disabled: true,
      icon: "crown"
    });
  });

  test("names the role of an account that does not own the project", () => {
    assert.deepEqual(readHeader({
      id: "b2",
      username: "bob",
      role: "member",
      owner: false
    }), {
      id: "account",
      label: "bob · Member",
      disabled: true
    });
  });
});
