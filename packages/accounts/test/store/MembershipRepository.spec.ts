// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  OTHER_REALM,
  REALM,
  addMembership,
  databaseWith,
  requestAccess
} from "../helpers/accounts.ts";
import { Membership } from "#src/realm/Membership.ts";

describe("MembershipRepository", () => {
  test("keeps one membership per account and realm, oldest first", () => {
    using database = databaseWith("Alice", "Bob");
    const [, bob] = database.accounts;
    const carol = requestAccess(database, "Carol");
    addMembership(database, Membership.active(OTHER_REALM, bob.id, "member"));

    database.memberships.save(Membership.active(REALM, bob.id, "member"));

    assert.deepEqual(database.memberships.inRealm(REALM), [
      Membership.active(REALM, bob.id, "member"),
      Membership.request(REALM, carol.id, "spectator")
    ]);
    assert.equal(database.memberships.pendingSize(REALM), 1);
    assert.equal(database.memberships.pendingSize(OTHER_REALM), 0);
    assert.deepEqual(
      database.memberships.realmIds().toSorted(),
      [OTHER_REALM, REALM].toSorted()
    );
  });

  test("deletes the membership of one realm only", () => {
    using database = databaseWith("Alice", "Bob");
    const [, bob] = database.accounts;
    addMembership(database, Membership.active(OTHER_REALM, bob.id, "member"));

    database.memberships.delete(REALM, bob.id);

    assert.equal(database.memberships.find(REALM, bob.id), null);
    assert.deepEqual(
      database.memberships.find(OTHER_REALM, bob.id),
      Membership.active(OTHER_REALM, bob.id, "member")
    );
  });
});
