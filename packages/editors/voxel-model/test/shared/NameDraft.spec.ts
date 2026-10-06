// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { NameDraft } from "#src/shared/NameDraft.ts";

describe("NameDraft", () => {
  test("starts on its fallback and resolves a blank text to it", () => {
    const draft = new NameDraft("Block");

    assert.equal(draft.text, "Block");
    assert.equal(draft.edit("  ").name, "Block");
    assert.equal(draft.edit(" Arm ").name, "Arm");
  });

  test("validates the resolved name, not the raw text", () => {
    const seen: string[] = [];
    const draft = new NameDraft("Block", (name) => {
      seen.push(name);

      return name === "Arm" ? "taken" : null;
    });

    assert.equal(draft.edit(" Arm ").error, "taken");
    assert.equal(draft.edit("").error, null);
    assert.deepEqual(seen, ["Arm", "Block"]);
  });
});
