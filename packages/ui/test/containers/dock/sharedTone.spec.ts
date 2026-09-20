// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  sharedAreaTone,
  type TonedPane
} from "../../../src/containers/dock/sharedTone.ts";

function group(
  active: TonedPane | null
) {
  return {
    activePane: () => active
  };
}

describe("sharedAreaTone", () => {
  test("takes the tone of the first slot", () => {
    const tone = sharedAreaTone([
      { ownTone: "pink" },
      { ownTone: "teal" }
    ]);

    assert.equal(tone, "pink");
  });

  test("reads a group through its active pane", () => {
    const tone = sharedAreaTone([
      group({ ownTone: "violet" }),
      { ownTone: "teal" }
    ]);

    assert.equal(tone, "violet");
  });

  test("skips untoned panes and groups without an active pane", () => {
    const tone = sharedAreaTone([
      group(null),
      { ownTone: null },
      group({ ownTone: null }),
      { ownTone: "amber" }
    ]);

    assert.equal(tone, "amber");
  });

  test("shares nothing when no visible pane is toned", () => {
    assert.equal(sharedAreaTone([]), null);
    assert.equal(sharedAreaTone([{ ownTone: null }]), null);
  });
});
