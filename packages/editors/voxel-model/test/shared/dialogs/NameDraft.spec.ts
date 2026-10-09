// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { NameDraft } from "#src/shared/dialogs/NameDraft.ts";

describe("NameDraft", () => {
  test("starts on its fallback and resolves a blank text to it", () => {
    const draft = new NameDraft("Block");

    assert.equal(draft.text, "Block");
    assert.equal(draft.edit("  ").name, "Block");
    assert.equal(draft.edit(" Arm ").name, "Arm");
  });

  test("validates the resolved name, not the raw text", () => {
    const draft = new NameDraft("Block", (name) => (name === "Arm" || name === "" ? "refused" : null));

    assert.equal(draft.edit(" Arm ").error, "refused");
    assert.equal(draft.edit("").error, null);
  });

  test("revalidates its unchanged text against names taken since the last edit", () => {
    const taken = new Set<string>();
    const draft = new NameDraft("Block", (name) => (taken.has(name) ? "taken" : null)).edit("Arm");

    taken.add("Arm");

    assert.equal(draft.error, null);
    assert.equal(draft.revalidate().error, "taken");
    assert.equal(draft.revalidate().text, "Arm");
  });
});
