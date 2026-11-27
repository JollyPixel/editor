// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Member } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import { accountEntry } from "#src/audit/node/AuditEntry.ts";
import type { AuditFeedQuery } from "#src/audit/node/AuditFeed.ts";
import {
  ADMIN,
  AUDITOR,
  MINUTE,
  feedHarness,
  summary
} from "../../helpers/auditFeed.ts";

describe("AuditFeed", () => {
  test("pages newest first, without repeating or dropping a row", async() => {
    using harness = await feedHarness();
    for (let minute = 0; minute < 5; minute++) {
      harness.edits("alice", `map-${minute}`, [minute * 10, minute * 10]);
      harness.settings("bob", minute * 10);
    }

    const pages: string[][] = [];
    let cursor: string | undefined;
    do {
      const page = harness.feed.page(ADMIN, { limit: 3, cursor });
      pages.push(page.rows.map(summary));
      cursor = page.next ?? undefined;
    }
    while (cursor !== undefined);

    assert.deepEqual(pages.map((page) => page.length), [3, 3, 3, 1]);
    assert.deepEqual(pages.flat(), [
      "Bob settings",
      "Alice map-4 40-40",
      "Bob settings",
      "Alice map-3 30-30",
      "Bob settings",
      "Alice map-2 20-20",
      "Bob settings",
      "Alice map-1 10-10",
      "Bob settings",
      "Alice map-0 0-0"
    ]);
  });

  test("shows account rows and their actors to admins only, and filters rows", async() => {
    using harness = await feedHarness();
    harness.audit.record(accountEntry({
      type: "role-changed",
      actorId: "carol",
      accountId: "bob",
      username: "Bob",
      from: "member",
      to: "spectator"
    }));
    harness.edits("bob", "map", [1, 4]);
    harness.edits("alice", "sky", [6, 6]);

    function page(
      query: AuditFeedQuery,
      viewer = AUDITOR
    ): string[] {
      return harness.feed.page(viewer, query).rows.map(summary);
    }

    function actors(
      viewer: Member
    ): string[] {
      return harness.feed.actors(viewer).map(({ key }) => key);
    }

    assert.equal(page({ category: "accounts" }, ADMIN).length, 1);
    assert.deepEqual(page({ category: "accounts" }), []);
    assert.deepEqual(actors(ADMIN), ["user:alice", "user:bob", "user:carol"]);
    assert.deepEqual(actors(AUDITOR), ["user:alice", "user:bob"]);
    assert.deepEqual(page({ actor: "user:bob" }), ["Bob map 1-4"]);
    assert.deepEqual(page({ asset: "sky" }), ["Alice sky 6-6"]);
    assert.deepEqual(page({ from: 3 * MINUTE, to: 5 * MINUTE }), ["Bob map 1-4"]);
  });

  test("names golems, removed accounts and system sources, and lists every actor once", async() => {
    using harness = await feedHarness();
    harness.edits("agent:builder", "map", [0, 0]);
    harness.edits("agent:gone", "map", [1, 1]);
    harness.edits("carol", "map", [2, 2]);
    harness.edits("carol", "sky", [3, 3]);
    harness.audit.record({
      type: "asset",
      at: 4 * MINUTE,
      actor: {
        type: "system",
        source: "fs-watcher"
      },
      assetId: "gone",
      action: "deleted",
      path: "old.voxelmap.json"
    });

    assert.deepEqual(harness.feed.actors(ADMIN), [
      {
        key: "user:agent:builder",
        id: "agent:builder",
        name: "Builder (Bob)",
        kind: "agent"
      },
      {
        key: "user:agent:gone",
        id: "agent:gone",
        name: "Deleted golem",
        kind: "deleted"
      },
      {
        key: "user:carol",
        id: "carol",
        name: "Deleted user",
        kind: "deleted"
      },
      {
        key: "system:fs-watcher",
        id: null,
        name: "Files on disk",
        kind: "system"
      }
    ]);
    const [deleted] = harness.feed.page(ADMIN, { category: "structure" }).rows;
    assert.ok(deleted.type === "asset");
    assert.deepEqual(deleted.asset, {
      id: "gone",
      path: "old.voxelmap.json"
    });
  });

  test("points an edit run at its history versions only once both ends are kept apart", async() => {
    using harness = await feedHarness();
    harness.edits("alice", "map", [0, 0], { from: 3, to: 9 });
    harness.edits("alice", "map", [1, 1], { from: 9, to: 9 });
    harness.edits("alice", "map", [2, 2], { from: 9, to: null });

    const versions = harness.feed.page(ADMIN, {}).rows
      .map((row) => (row.type === "edits" ? row.versions : undefined));

    assert.deepEqual(versions, [null, null, {
      from: "history/3",
      to: "history/9"
    }]);
  });
});
