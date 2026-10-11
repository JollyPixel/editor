// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createDirectory,
  databaseWith,
  name
} from "../helpers/accounts.ts";
import { SessionToken } from "#src/session/SessionToken.ts";
import { ShareLinks } from "#src/share/ShareLinks.ts";
import { ShareLinkNotFoundError } from "#src/share/errors/ShareLinkNotFoundError.ts";
import { ShareLinkRefusedError } from "#src/share/errors/ShareLinkRefusedError.ts";
import type { AccountsDatabase } from "#src/store/AccountsDatabase.ts";
import type { AccountDirectory } from "#src/AccountDirectory.ts";

interface Harness extends Disposable {
  database: AccountsDatabase;
  directory: AccountDirectory;
  links: ShareLinks;
  revoked: string[];
  ids: string[];
}

function harness(): Harness {
  const database = databaseWith("Alice", "Bob", "Carol");
  const directory = createDirectory(database);
  const links = new ShareLinks(database.shareLinks, directory);
  const revoked: string[] = [];
  directory.on("revoked", (subject) => revoked.push(subject));

  return {
    database,
    directory,
    links,
    revoked,
    ids: [...database.accounts].map((account) => account.id),
    [Symbol.dispose]() {
      links[Symbol.dispose]();
      database.close();
    }
  };
}

describe("ShareLinks", () => {
  test("finds a link by the token it was created with, and by its subject", () => {
    using h = harness();
    const [alice] = h.ids;

    const link = h.links.create({
      assetId: "map-1",
      createdBy: alice,
      expiresAt: null
    });

    assert.deepEqual(h.links.find(link.token), link);
    assert.deepEqual(h.links.bySubject(`share:${link.id}`), link);
    assert.equal(h.links.find(SessionToken.mint().value), null);
    assert.equal(h.links.find("not a token"), null);
    assert.equal(h.links.bySubject(alice), null);
  });

  test("ends a link at its expiry and revokes its guests", (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"] });
    using h = harness();
    const link = h.links.create({
      assetId: "map-1",
      createdBy: h.ids[0],
      expiresAt: 1_000
    });

    t.mock.timers.tick(999);
    assert.deepEqual(h.links.find(link.token), link);
    assert.deepEqual(h.revoked, []);

    t.mock.timers.tick(1);
    assert.equal(h.links.find(link.token), null);
    assert.deepEqual(h.links.visibleTo(h.ids[0]), []);
    assert.deepEqual(h.revoked, [`share:${link.id}`]);
  });

  test("refuses an expiry that has already passed", () => {
    using h = harness();

    assert.throws(
      () => h.links.create({
        assetId: "map-1",
        createdBy: h.ids[0],
        expiresAt: Date.now()
      }),
      RangeError
    );
  });

  test("shows a member the links they created and an admin every link", () => {
    using h = harness();
    const [alice, bob, carol] = h.ids;
    const bobs = h.links.create({
      assetId: "map-1",
      createdBy: bob,
      expiresAt: null
    });
    const alices = h.links.create({
      assetId: "map-2",
      createdBy: alice,
      expiresAt: null
    });

    assert.deepEqual(h.links.visibleTo(bob), [bobs]);
    assert.deepEqual(h.links.visibleTo(carol), []);
    assert.deepEqual(h.links.visibleTo(alice), [bobs, alices]);
  });

  test("lets the creator and an admin revoke a link, nobody else", () => {
    using h = harness();
    const [alice, bob, carol] = h.ids;
    const bobs = h.links.create({
      assetId: "map-1",
      createdBy: bob,
      expiresAt: null
    });
    const carols = h.links.create({
      assetId: "map-1",
      createdBy: carol,
      expiresAt: null
    });

    assert.throws(
      () => h.links.revoke(carol, bobs.id),
      ShareLinkRefusedError
    );
    assert.deepEqual(h.links.revoke(bob, bobs.id), bobs);
    assert.deepEqual(h.links.revoke(alice, carols.id), carols);
    assert.throws(
      () => h.links.revoke(alice, carols.id),
      ShareLinkNotFoundError
    );
    assert.deepEqual(h.links.visibleTo(alice), []);
    assert.deepEqual(h.revoked, [
      `share:${bobs.id}`,
      `share:${carols.id}`
    ]);
  });

  test("removing an account revokes the links it created", () => {
    using h = harness();
    const [alice, bob] = h.ids;
    const link = h.links.create({
      assetId: "map-1",
      createdBy: bob,
      expiresAt: null
    });

    h.directory.remove(alice, name("Bob"));

    assert.equal(h.links.find(link.token), null);
    assert.deepEqual(h.revoked, [bob, `share:${link.id}`]);
  });
});
