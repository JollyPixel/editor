// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  render,
  svg
} from "lit";

// Import Internal Dependencies
import {
  getIcon,
  registerIcon
} from "../../src/icon/registry.ts";

describe("Icon.registerIcon", () => {
  test("renders a string glyph as SVG markup", () => {
    const container = document.createElement("div");
    registerIcon(
      "test-string-glyph",
      "<path data-test-glyph=\"string\" />"
    );

    render(svg`<svg>${getIcon("test-string-glyph")}</svg>`, container);

    assert.ok(
      container.querySelector('path[data-test-glyph="string"]')
    );
  });

  test("retains a Lit SVG template result", () => {
    const glyph = svg`<path data-test-glyph="template" />`;
    registerIcon("test-template-glyph", glyph);

    assert.equal(getIcon("test-template-glyph"), glyph);
  });
});
