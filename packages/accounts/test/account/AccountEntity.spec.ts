// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AccountEntity } from "#src/account/AccountEntity.ts";
import { name } from "../helpers/accounts.ts";
import { AccountChangeRefusedError } from "#src/node.ts";

// CONSTANTS
const kMember = new AccountEntity({
  id: "a1",
  username: "Alice",
  role: "member",
  status: "active",
  avatarHash: null,
  owner: false
});

describe("AccountEntity", () => {
  test("claim creates an active admin owner, register and request do not own", () => {
    const owner = AccountEntity.claim(name("Alice"));
    const member = AccountEntity.register(name("Bob"), "member");
    const request = AccountEntity.request(name("Carol"), "member");

    assert.deepEqual(
      [owner, member, request].map(({ role, status, owner }) => [role, status, owner]),
      [["admin", "active", true], ["member", "active", false], ["member", "pending", false]]
    );
    assert.notEqual(owner.id, member.id);
  });

  test("isAdmin reads the admin role of an active account only", () => {
    const pendingAdmin = AccountEntity.request(name("Bob"), "admin");

    assert.equal(kMember.isAdmin, false);
    assert.equal(kMember.withRole("admin").isAdmin, true);
    assert.equal(pendingAdmin.isAdmin, false);
    assert.equal(pendingAdmin.approved("admin").isAdmin, true);
  });

  test("assertAdmin refuses an active member and a pending admin", () => {
    for (const account of [kMember, AccountEntity.request(name("Bob"), "admin")]) {
      assert.throws(
        () => account.assertAdmin(),
        {
          name: "AccountChangeRefusedError",
          message: "only an admin manages accounts"
        }
      );
    }
    kMember.withRole("admin").assertAdmin();
  });

  test("assertOwner and assertNotOwner split owners from everyone else", () => {
    const owner = kMember.promotedToOwner();

    assert.throws(() => kMember.assertOwner(), AccountChangeRefusedError);
    assert.throws(
      () => owner.assertNotOwner(),
      {
        name: "AccountChangeRefusedError",
        message: "\"Alice\" is the owner"
      }
    );
    owner.assertOwner();
    kMember.assertNotOwner();
  });

  test("transitions copy without touching the original", () => {
    const changed = kMember.promotedToOwner().withAvatar("abc");

    assert.deepEqual(
      changed,
      new AccountEntity({
        id: "a1",
        username: "Alice",
        role: "admin",
        status: "active",
        avatarHash: "abc",
        owner: true
      })
    );
    assert.equal(kMember.role, "member");
    assert.equal(kMember.owner, false);
    assert.equal(kMember.avatarHash, null);
  });
});
