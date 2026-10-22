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
    const draft = AccessDraft.from(kAccess).addRole(" reviewer ");

    assert.deepEqual(draft.roles, ["member", "spectator", "reviewer"]);
    assert.equal(draft.rules("reviewer").match("voxelmap.place")?.rule.right, "read");
    assert.equal(draft.rules("reviewer").match("voxelmap.$join")?.rule.right, "write");
    for (const name of ["admin", "guest", "member", ""]) {
      assert.throws(() => draft.addRole(name), RangeError, name);
    }
  });

  test("refuses to delete the default role", () => {
    const draft = AccessDraft.from(kAccess);

    assert.throws(() => draft.deleteRole("spectator"), RangeError);
    assert.deepEqual(draft.deleteRole("member").roles, ["spectator"]);
  });

  test("renames a role in place and sends its saved name with the change", () => {
    const draft = AccessDraft.from(kAccess).renameRole("spectator", " viewer ");

    assert.deepEqual(draft.roles, ["member", "viewer"]);
    assert.equal(draft.defaultRole, "viewer");
    assert.deepEqual(draft.rules("viewer").toJSON(), kAccess.roles.spectator);
    assert.deepEqual(draft.toChange().renamedRoles, { spectator: "viewer" });
    assert.deepEqual(
      draft.renameRole("viewer", "spectator").toChange().renamedRoles,
      {}
    );
  });

  test("keeps every saved role name until the draft is saved", () => {
    const draft = AccessDraft.from(kAccess).renameRole("member", "editor");
    const deleted = AccessDraft.from(kAccess).deleteRole("member");

    assert.throws(() => draft.addRole("member"), RangeError);
    assert.throws(() => draft.renameRole("spectator", "member"), RangeError);
    assert.throws(() => draft.renameRole("editor", "spectator"), RangeError);
    assert.throws(() => deleted.renameRole("spectator", "member"), RangeError);
  });

  test("sends no rename for a role the draft added", () => {
    const draft = AccessDraft.from(kAccess)
      .addRole("reviewer")
      .renameRole("reviewer", "critic");

    assert.deepEqual(draft.roles, ["member", "spectator", "critic"]);
    assert.deepEqual(draft.toChange().renamedRoles, {});
  });
});
