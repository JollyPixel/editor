// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  RoomGrants,
  type GrantsRoom,
  type Right,
  type RoomRights
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  canEditText,
  SCRIPT_CAPABILITY_TABLE
} from "#src/access/ScriptAccess.ts";

function roomWith(
  rights: RoomRights
): GrantsRoom {
  return {
    clientId: "A",
    can: (event: string): Right => rights[event] ?? "void",
    on: () => void 0,
    off: () => void 0
  };
}

describe("ScriptAccess", () => {
  test("a reader who may still publish presence cannot edit the text", () => {
    const grants = new RoomGrants(roomWith({
      $join: "write",
      $presence: "write",
      edited: "read",
      "lint-requested": "read"
    }), SCRIPT_CAPABILITY_TABLE);

    assert.equal(canEditText(grants.current), false);
  });

  test("a writer can edit the text", () => {
    const grants = new RoomGrants(roomWith({
      $presence: "write",
      edited: "write"
    }), SCRIPT_CAPABILITY_TABLE);

    assert.equal(canEditText(grants.current), true);
  });
});
