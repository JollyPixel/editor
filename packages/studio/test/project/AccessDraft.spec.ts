// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AccessDraft } from "../../src/project/AccessDraft.ts";

// CONSTANTS
const kAccess = {
  defaultRole: "spectator",
  roles: {
    member: {
      "*": "write"
    },
    spectator: {
      "*": "read"
    }
  },
  accessRequests: false
} as const;

describe("AccessDraft", () => {
  test("adds a read-only role and refuses a built-in or taken name", () => {
    const draft = new AccessDraft(kAccess).addRole(" reviewer ");

    assert.deepEqual(draft.roles, ["member", "spectator", "reviewer"]);
    assert.equal(draft.rules("reviewer").match("voxelmap.place")?.rule.right, "read");
    assert.equal(draft.rules("reviewer").match("voxelmap.$join")?.rule.right, "write");
    for (const name of ["admin", "guest", "member", ""]) {
      assert.throws(() => draft.addRole(name), RangeError, name);
    }
  });

  test("refuses to delete the default role", () => {
    const draft = new AccessDraft(kAccess);

    assert.throws(() => draft.deleteRole("spectator"), RangeError);
    assert.deepEqual(draft.deleteRole("member").roles, ["spectator"]);
  });
});
