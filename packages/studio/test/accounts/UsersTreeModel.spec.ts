// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { RosterEntry } from "@jolly-pixel/accounts";
import type { ContextMenuItem } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  UsersTreeModel,
  parseRoleAction
} from "../../src/accounts/UsersTreeModel.ts";

// CONSTANTS
const kRoles = ["admin", "member", "spectator"];
const kEntries: RosterEntry[] = [
  {
    id: "a",
    username: "alice",
    role: "admin",
    online: true
  },
  {
    id: "b",
    username: "bob",
    role: "spectator",
    avatar: "/api/accounts/b/avatar?v=0123456789abcdef",
    online: false
  },
  {
    id: "c",
    username: "carol",
    role: "spectator",
    online: true
  }
];

describe("UsersTreeModel", () => {
  test("groups accounts under every role, in role order, with an online count", () => {
    const model = new UsersTreeModel(kRoles, kEntries, "a");

    assert.deepEqual(
      model.nodes.map((node) => [
        node.label,
        node.detail,
        node.children?.map((child) => child.label)
      ]),
      [
        ["Admin", "1/1", ["alice"]],
        ["Member", "0/0", []],
        ["Spectator", "1/2", ["bob", "carol"]]
      ]
    );
  });

  test("colours a user by its account and fades it while offline", () => {
    const model = new UsersTreeModel(kRoles, kEntries, "a");
    const [admin, , spectator] = model.nodes;
    const alice = admin.children?.[0];
    const bob = spectator.children?.[0];

    assert.equal(alice?.swatch?.title, "Online");
    assert.equal(alice?.detail, "you");
    assert.equal(bob?.swatch?.title, "Offline");
    assert.match(bob?.swatch?.color ?? "", /^color-mix\(in srgb, .+ 30%, transparent\)$/);
  });

  test("draws each user's avatar, with the uploaded image when there is one", () => {
    const model = new UsersTreeModel(kRoles, kEntries, "a");
    const [admin, , spectator] = model.nodes;

    assert.deepEqual(admin.children?.[0].avatar, {
      peerId: "a",
      image: undefined
    });
    assert.equal(
      spectator.children?.[0].avatar?.image,
      "/api/accounts/b/avatar?v=0123456789abcdef"
    );
  });

  test("resolves a user row back to its roster entry", () => {
    const model = new UsersTreeModel(kRoles, kEntries, "a");
    const [, , spectator] = model.nodes;
    const bobId = spectator.children?.[0].id ?? "";

    assert.equal(model.entry(bobId)?.username, "bob");
    assert.equal(model.entry(spectator.id), undefined);
  });

  test("offers every other role and refuses to remove oneself", () => {
    const model = new UsersTreeModel(kRoles, kEntries, "a");
    const [role, , remove] = model.menu(kEntries[1]) as ContextMenuItem[];
    const [self, , removeSelf] = model.menu(kEntries[0]) as ContextMenuItem[];

    assert.deepEqual(
      role.items?.map((item) => item !== "separator" && [item.label, item.disabled]),
      [["Admin", false], ["Member", false], ["Spectator", true]]
    );
    assert.equal(parseRoleAction("role:member"), "member");
    assert.equal(parseRoleAction("remove"), null);
    assert.equal(remove.disabled, false);
    assert.equal(self.items?.length, 3);
    assert.equal(removeSelf.disabled, true);
  });
});
