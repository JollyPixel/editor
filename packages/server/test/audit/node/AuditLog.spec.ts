// Import Node.js Dependencies
import path from "node:path";
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  AUDIT_DATABASE_FILE,
  AuditLog
} from "#src/audit/node/AuditLog.ts";
import {
  createTempDir,
  removeTempDir
} from "../../helpers/tempDir.ts";

describe("AuditLog", () => {
  test("moves the rows of an audit log written as an event store, once", async(t) => {
    const dir = await createTempDir("jolly-audit-");
    t.after(() => removeTempDir(dir));
    const location = path.join(dir, AUDIT_DATABASE_FILE);
    const legacy = await EventStore.persistence.sqlite(location);
    const actor = {
      type: "user",
      id: "alice"
    } as const;
    (await legacy.writer.append({
      assetType: "settings",
      assetId: "game",
      eventType: "settings.changed",
      eventData: {
        section: "game",
        before: { start: null },
        after: { start: "arena" }
      },
      actor
    })).unwrap();
    (await legacy.writer.append({
      assetType: "account",
      assetId: "bob",
      eventType: "account.removed",
      eventData: {
        type: "removed",
        actorId: "alice",
        accountId: "bob",
        username: "Bob"
      },
      actor
    })).unwrap();
    await legacy.close();

    const everything = {
      withoutAccounts: false
    };
    using first = await AuditLog.open(location);
    const moved = first.page(everything, 10).map(({ entry }) => entry.type);
    first.close();
    using second = await AuditLog.open(location);

    assert.deepEqual(moved, ["account", "settings"]);
    assert.deepEqual(second.page(everything, 10).map(({ entry }) => entry.type), moved);
  });
});
