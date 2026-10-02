// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { idListChanged } from "../../src/data/tree/model.ts";
import { samePointerDropPreview } from "../../src/data/tree/interaction.ts";

describe("Data.idListChanged", () => {
  test("treats a copy with the same IDs in order as unchanged", () => {
    assert.equal(idListChanged(["a", "b"], ["a", "b"]), false);
    assert.equal(idListChanged([], []), false);
  });

  test("reports a different order, length or ID as changed", () => {
    assert.equal(idListChanged(["b", "a"], ["a", "b"]), true);
    assert.equal(idListChanged(["a"], ["a", "b"]), true);
    assert.equal(idListChanged(["a", "c"], ["a", "b"]), true);
  });

  test("reports the first assignment as changed", () => {
    assert.equal(idListChanged([], undefined), true);
  });

  test("falls back to identity for values that are not arrays", () => {
    assert.equal(idListChanged(null, null), false);
    assert.equal(idListChanged(null, []), true);
  });
});

describe("Data.samePointerDropPreview", () => {
  const preview = {
    targetId: "a",
    where: "inside" as const,
    anchorId: "a"
  };

  test("matches two empty previews", () => {
    assert.equal(samePointerDropPreview(null, null), true);
  });

  test("matches equal fields across copies", () => {
    assert.equal(samePointerDropPreview(preview, { ...preview }), true);
  });

  test("tells an empty preview from a target", () => {
    assert.equal(samePointerDropPreview(null, preview), false);
    assert.equal(samePointerDropPreview(preview, null), false);
  });

  test("compares target, zone and anchor", () => {
    assert.equal(samePointerDropPreview(preview, { ...preview, targetId: "b" }), false);
    assert.equal(samePointerDropPreview(preview, { ...preview, where: "above" }), false);
    assert.equal(samePointerDropPreview(preview, { ...preview, anchorId: "b" }), false);
  });
});
