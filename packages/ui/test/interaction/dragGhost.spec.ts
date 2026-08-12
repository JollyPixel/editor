// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { themeTokenNames } from "../../src/interaction/dragGhost.ts";

describe("Interaction.themeTokenNames", () => {
  test("reads the tokens a scope host declares", () => {
    const names = themeTokenNames();

    assert.ok(names.length > 0);
    for (const name of names) {
      assert.match(name, /^--jolly-[a-z0-9-]+$/);
    }
  });

  test("covers the ramp, surface, density and scale groups", () => {
    const names = new Set(
      themeTokenNames()
    );

    // One per stylesheet composed into "themeStyles", so a group dropped from
    // the composition cannot go unnoticed.
    assert.ok(names.has("--jolly-accent-fill"));
    assert.ok(names.has("--jolly-surface"));
    assert.ok(names.has("--jolly-pane-header-bg"));
    assert.ok(names.has("--jolly-folder-header-bg"));
    assert.ok(names.has("--jolly-row-height"));
    assert.ok(names.has("--jolly-radius-md"));
  });

  test("lists each name once, whatever the theme redeclares", () => {
    const names = themeTokenNames();

    assert.equal(
      new Set(names).size,
      names.length
    );
  });

  test("collects declarations only, never usages", () => {
    // Every token is used at least once inside a "var()", so a pattern that
    // matched usages too would report names no scope host actually declares.
    assert.ok(
      !themeTokenNames().includes("--jolly-neutral-100")
    );
  });

  test("returns the same list on every call", () => {
    assert.equal(
      themeTokenNames(),
      themeTokenNames()
    );
  });
});
