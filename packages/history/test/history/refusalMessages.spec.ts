// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Internal Dependencies
import {
  describeRefusal,
  describeSkippedStep
} from "../../src/index.ts";

describe("describeSkippedStep", () => {
  test("names the skipped step and why it was refused", () => {
    assert.equal(
      describeSkippedStep({ label: "Paint", refused: { reason: "peer", clientId: "alice" } }),
      "Skipped \"Paint\": a peer changed it since"
    );
    assert.equal(
      describeSkippedStep(
        { label: null, refused: { reason: "changed" } },
        { changed: "its voxels moved or changed since" }
      ),
      "Skipped a step: its voxels moved or changed since"
    );
  });
});

describe("describeRefusal", () => {
  test("names a known peer and falls back for an unknown or anonymous one", () => {
    const wording = {
      peerName: (clientId: string) => (clientId === "alice" ? "Alice" : undefined)
    };

    assert.equal(describeRefusal({ reason: "peer", clientId: "alice" }, wording), "Alice changed it since");
    assert.equal(describeRefusal({ reason: "peer", clientId: "bob" }, wording), "a peer changed it since");
    assert.equal(describeRefusal({ reason: "peer", clientId: null }, wording), "it was changed since");
  });

  test("words a closed document as gone unless told otherwise", () => {
    const closed = { reason: "closed", documentId: "set" } as const;
    const wording = { closed: "its animation set is closed" };

    assert.equal(describeRefusal(closed), "it is gone");
    assert.equal(describeRefusal(closed, wording), wording.closed);
  });
});
