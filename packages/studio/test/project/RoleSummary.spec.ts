// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AccessDraft } from "../../src/project/AccessDraft.ts";
import { roleSummaries } from "../../src/project/RoleSummary.ts";

// CONSTANTS
const kDraft = AccessDraft.from({
  defaultRole: "spectator",
  roles: {
    member: {
      "*": "write"
    },
    spectator: {
      "*": "read"
    },
    critic: {
      "*": "read"
    }
  },
  accessRequests: false
})
  .renameRole("member", "editor")
  .addRole("reviewer");
const kAccounts = [
  { role: "admin" },
  { role: "member" },
  { role: "member" },
  { role: "spectator" },
  { role: "spectator" }
];

describe("roleSummaries", () => {
  test("counts members under the saved name, none for guest or an unsaved role", () => {
    assert.deepEqual(
      roleSummaries(kDraft, kAccounts).map(({ name, heldAs, members }) => [name, heldAs, members]),
      [
        ["admin", "admin", 1],
        ["guest", null, null],
        ["editor", "member", 2],
        ["spectator", "spectator", 2],
        ["critic", "critic", 0],
        ["reviewer", null, null]
      ]
    );
  });

  test("blocks deleting a built-in, the default or a held role", () => {
    const blockers = Object.fromEntries(
      roleSummaries(kDraft, kAccounts.slice(0, 3)).map(({ name, deleteBlocker }) => [name, deleteBlocker])
    );

    assert.deepEqual(blockers, {
      admin: "Built in",
      guest: "Built in",
      editor: "2 accounts hold this role",
      spectator: "New accounts get this role",
      critic: null,
      reviewer: null
    });
  });
});
