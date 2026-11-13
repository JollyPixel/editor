// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { svg } from "lit";

// Import Internal Dependencies
import "../../src/icon/builtins.ts";
import {
  getIcon,
  iconTone,
  registerIcon
} from "../../src/icon/registry.ts";

describe("Icon built-ins", () => {
  test("a built-in never replaces a glyph registered under its name first", async(t) => {
    const builtin = getIcon("loop");
    const builtinTone = iconTone("loop");
    assert.notEqual(builtin, null);
    t.after(() => registerIcon("loop", builtin!, {
      tone: builtinTone ?? undefined
    }));

    const own = svg`<path data-test-glyph="own-loop" />`;
    registerIcon("loop", own, { tone: "pink" });
    const reload = new URL(
      "../../src/icon/builtins.ts?reload",
      import.meta.url
    );
    await import(reload.href);

    assert.equal(getIcon("loop"), own);
    assert.equal(iconTone("loop"), "pink");
  });
});
