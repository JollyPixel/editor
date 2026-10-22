// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import {
  ADMIN_ROLE,
  type Account
} from "@jolly-pixel/accounts";
import { SNAPSHOT_ACTOR } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { AssetLog } from "../../../server/audit/AssetLog.ts";
import {
  AuditFeed,
  type AuditFeedQuery
} from "../../../server/audit/AuditFeed.ts";
import { AuditLog } from "../../../server/audit/AuditLog.ts";
import { StudioAccess } from "../../../server/project/StudioAccess.ts";
import type { AuditRow } from "../../../shared/api/audit.ts";

// CONSTANTS
const kMinute = 60_000;
const kUsernames: Record<string, string> = {
  alice: "Alice",
  bob: "Bob"
};
const kAuditor = "auditor";
const kAccess = StudioAccess.from({
  defaultRole: kAuditor,
  roles: {
    [kAuditor]: {
      "studio.$audit": "read"
    }
  },
  accessRequests: false
}, "audit test");
const kAdmin: Account = {
  id: "alice",
  username: "Alice",
  role: ADMIN_ROLE,
  owner: true
};
const kAuditorAccount: Account = {
  id: "bob",
  username: "Bob",
  role: kAuditor,
  owner: false
};

interface FeedHarness {
  events: EventStore.EventStore;
  audit: AuditLog;
  feed: AuditFeed;
  at(minutes: number): void;
  edit(assetId: string, actorId: string): void;
}

function feedHarness(
  t: TestContext
): FeedHarness {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  const events = EventStore.persistence.memory();
  const audit = new AuditLog(EventStore.persistence.memory());

  return {
    events,
    audit,
    feed: new AuditFeed({
      project: {
        access: kAccess
      },
      assets: new AssetLog(events),
      audit,
      account: (id) => (Object.hasOwn(kUsernames, id) ?
        {
          id,
          username: kUsernames[id],
          role: "member",
          owner: false
        } :
        null),
      assetPath: (assetId) => `${assetId}.voxelmap.json`
    }),
    at: (minutes) => t.mock.timers.setTime(minutes * kMinute),
    edit(assetId, actorId) {
      events.writer.append({
        assetType: "voxelmap",
        assetId,
        eventType: "voxelmap.command",
        eventData: {},
        actor: {
          type: "user",
          id: actorId
        }
      }).unwrap();
    }
  };
}

function summary(
  row: AuditRow
): string {
  return row.type === "edits" ?
    `${row.actor.name} ${row.asset.id} x${row.count} ${row.from / kMinute}-${row.to / kMinute}` :
    `${row.actor.name} ${row.type} ${row.at / kMinute}`;
}

function allPages(
  feed: AuditFeed,
  query: AuditFeedQuery
): string[][] {
  const pages: string[][] = [];
  let cursor: string | undefined;
  do {
    const page = feed.page(kAdmin, { ...query, cursor });
    pages.push(page.rows.map(summary));
    cursor = page.next ?? undefined;
  }
  while (cursor !== undefined);

  return pages;
}

describe("AuditFeed", () => {
  test("folds one actor's edits on one asset less than 5 minutes apart, around other actors", (t) => {
    const harness = feedHarness(t);
    harness.at(0);
    harness.edit("map", "alice");
    harness.at(1);
    harness.edit("map", "bob");
    harness.at(2);
    harness.edit("map", "alice");
    harness.at(8);
    harness.edit("map", "alice");

    const { rows, next } = harness.feed.page(kAdmin, {});

    assert.equal(next, null);
    assert.deepEqual(rows.map(summary), [
      "Alice map x1 8-8",
      "Alice map x2 0-2",
      "Bob map x1 1-1"
    ]);
  });

  test("pages both stores newest first, without repeating or dropping a row", (t) => {
    const harness = feedHarness(t);
    for (let minute = 0; minute < 5; minute++) {
      harness.at(minute * 10);
      harness.edit(`map-${minute}`, "alice");
      harness.at(minute * 10 + 5);
      harness.audit.recordSettings("bob", {
        section: "kinds",
        before: {},
        after: {}
      });
    }

    const pages = allPages(harness.feed, {
      limit: 3
    });

    assert.deepEqual(pages.map((page) => page.length), [3, 3, 3, 1]);
    assert.deepEqual(pages.flat(), [
      "Bob settings 45",
      "Alice map-4 x1 40-40",
      "Bob settings 35",
      "Alice map-3 x1 30-30",
      "Bob settings 25",
      "Alice map-2 x1 20-20",
      "Bob settings 15",
      "Alice map-1 x1 10-10",
      "Bob settings 5",
      "Alice map-0 x1 0-0"
    ]);
  });

  test("keeps account rows for admins and filters by actor, asset and category", (t) => {
    const harness = feedHarness(t);
    harness.audit.recordAccount({
      type: "role-changed",
      actorId: "alice",
      accountId: "bob",
      username: "Bob",
      from: "member",
      to: "spectator"
    });
    harness.at(1);
    harness.edit("map", "bob");
    harness.edit("sky", "alice");

    function page(
      query: AuditFeedQuery,
      viewer = kAuditorAccount
    ): string[] {
      return harness.feed.page(viewer, query).rows.map(summary);
    }

    assert.deepEqual(page({ category: "accounts" }, kAdmin), ["Alice account 0"]);
    assert.deepEqual(page({ category: "accounts" }), []);
    assert.deepEqual(page({ actor: "bob" }), ["Bob map x1 1-1"]);
    assert.deepEqual(page({ asset: "sky" }), ["Alice sky x1 1-1"]);
    assert.deepEqual(page({ to: kMinute - 1 }), []);
  });

  test("names a removed account and skips the server's own snapshots", (t) => {
    const harness = feedHarness(t);
    harness.edit("map", "carol");
    harness.events.writer.append({
      assetType: "voxelmap",
      assetId: "map",
      eventType: "asset.updated",
      eventData: { path: "map.voxelmap.json" },
      actor: SNAPSHOT_ACTOR
    }).unwrap();

    const { rows } = harness.feed.page(kAdmin, {});

    assert.deepEqual(rows.map((row) => row.actor), [{
      id: "carol",
      name: "Deleted user",
      kind: "deleted"
    }]);
  });
});
