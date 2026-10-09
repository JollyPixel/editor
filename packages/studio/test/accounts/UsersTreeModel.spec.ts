// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  AccessRequest,
  RosterEntry
} from "@jolly-pixel/accounts";
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
const kRequest: AccessRequest = {
  id: "d",
  username: "dave"
};

function modelWith(
  requests: readonly AccessRequest[] = []
): UsersTreeModel {
  return new UsersTreeModel(
    kRoles,
    kEntries,
    requests,
    "a"
  );
}

describe("UsersTreeModel", () => {
  test("groups accounts under every role, in role order, with an online count", () => {
    const model = modelWith();

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

  test("lists access requests apart, before the roles, only when there are some", () => {
    const [requests] = modelWith([kRequest]).nodes;

    assert.deepEqual(
      [requests.label, requests.detail, requests.children?.map((child) => child.label)],
      ["Access requests", "1", ["dave"]]
    );
    assert.equal(modelWith().nodes[0].label, "Admin");
  });

  test("offers to approve a request under any role or deny it", () => {
    const model = modelWith([kRequest]);
    const [approve, , deny] = model.menu({
      type: "request",
      request: kRequest
    }) as ContextMenuItem[];

    assert.deepEqual(
      approve.items?.map((item) => item !== "separator" && parseRoleAction(item.id)),
      ["admin", "member", "spectator"]
    );
    assert.equal(deny.id, "deny");
  });

  test("colours a user by its account and fades it while offline", () => {
    const model = modelWith();
    const [admin, , spectator] = model.nodes;
    const alice = admin.children?.[0];
    const bob = spectator.children?.[0];

    assert.equal(alice?.swatch?.title, "Online");
    assert.equal(alice?.detail, "you");
    assert.equal(bob?.swatch?.title, "Offline");
    assert.match(bob?.swatch?.color ?? "", /^color-mix\(in srgb, .+ 30%, transparent\)$/);
  });

  test("draws each user's avatar, with the uploaded image when there is one", () => {
    const model = modelWith();
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

  test("resolves a user or request row back to its menu target", () => {
    const model = modelWith([kRequest]);
    const [requests, , , spectator] = model.nodes;

    assert.deepEqual(model.target(spectator.children?.[0].id ?? ""), {
      type: "user",
      entry: kEntries[1]
    });
    assert.deepEqual(model.target(requests.children?.[0].id ?? ""), {
      type: "request",
      request: kRequest
    });
    assert.equal(model.target(spectator.id), undefined);
    assert.equal(model.target(requests.id), undefined);
  });

  test("offers every other role and refuses to remove oneself", () => {
    const model = modelWith();
    const [role, , remove] = model.menu({
      type: "user",
      entry: kEntries[1]
    }) as ContextMenuItem[];
    const [self, , removeSelf] = model.menu({
      type: "user",
      entry: kEntries[0]
    }) as ContextMenuItem[];

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
