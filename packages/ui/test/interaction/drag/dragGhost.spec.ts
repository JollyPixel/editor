// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { themeTokenNames } from "../../../src/interaction/drag/dragGhost.ts";

describe("Interaction.themeTokenNames", () => {
  test("reads the tokens a scope host declares", () => {
    const names = themeTokenNames();

    assert.ok(names.length > 0);
    for (const name of names) {
      assert.match(name, /^--jolly-[a-z0-9-]+$/);
    }
  });
});
