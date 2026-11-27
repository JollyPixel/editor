// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  ADMIN,
  AUDITOR,
  MINUTE,
  feedHarness,
  user
} from "../../helpers/auditFeed.ts";

describe("AuditFeed export", () => {
  test("exports the filtered rows as CSV, neutralizing cells a spreadsheet would run", async() => {
    using harness = await feedHarness();
    harness.edits("alice", "=cmd", [0, 1]);
    harness.audit.record({
      type: "tag",
      at: 2 * MINUTE,
      actor: user("bob"),
      assetId: "map",
      action: "created",
      name: "v1",
      message: "=HYPERLINK(\"x\"), done"
    });
    harness.settings("bob", 3);

    const csv = [...harness.feed.export(ADMIN, { to: 2 * MINUTE })].join("");

    assert.equal(csv, [
      "Started,Ended,Actor,Actor kind,Category,Event,Asset,Details",
      [
        "1970-01-01T00:02:00.000Z,1970-01-01T00:02:00.000Z,Bob,user,structure",
        "tag created,map.voxelmap.json,\"v1: =HYPERLINK(\"\"x\"\"), done\""
      ].join(","),
      [
        "1970-01-01T00:00:00.000Z,1970-01-01T00:01:00.000Z,Alice,user,edits",
        "edits,'=cmd.voxelmap.json,1 edit"
      ].join(","),
      ""
    ].join("\r\n"));
    assert.throws(() => harness.feed.export({ ...AUDITOR, role: "nobody" }, {}));
  });
});
