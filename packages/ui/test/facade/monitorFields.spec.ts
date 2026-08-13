// Import Node.js Dependencies
import { test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { monitorFieldEntries } from "../../src/facade/monitorFields.ts";

test("monitorFieldEntries keeps configured monitor keys", () => {
  const entries = monitorFieldEntries({
    fps: { label: "fps" },
    status: { label: "status" },
    skipped: undefined
  });

  assert.deepEqual(entries, [
    ["fps", { label: "fps" }],
    ["status", { label: "status" }]
  ]);
});
