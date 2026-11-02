// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  SnapshotDocument,
  type DocumentResetCause
} from "#src/index.ts";

describe("SnapshotDocument", () => {
  test("holds its empty value, then the decoded value of each loaded snapshot", () => {
    const document = new SnapshotDocument<string, number | null>(
      null,
      (snapshot) => snapshot.length
    );
    const resets: DocumentResetCause[] = [];
    document.subscribe("reset", (cause) => resets.push(cause));
    assert.equal(document.value, null);

    document.load("abc");

    assert.equal(document.value, 3);
    assert.deepEqual(resets, ["load"]);
  });
});
