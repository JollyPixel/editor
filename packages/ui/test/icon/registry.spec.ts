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
  ICON_TONES,
  getIcon,
  iconTone,
  isIconTone,
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

  test("records the default tone of a glyph", () => {
    registerIcon("test-toned-glyph", "<path />", { tone: "violet" });

    assert.equal(iconTone("test-toned-glyph"), "violet");
  });

  test("reports no tone for an untoned or unknown glyph", () => {
    registerIcon("test-untoned-glyph", "<path />");

    assert.equal(iconTone("test-untoned-glyph"), null);
    assert.equal(iconTone("test-never-registered"), null);
  });

  test("drops the tone when a glyph is registered again without one", () => {
    registerIcon("test-retoned-glyph", "<path />", { tone: "coral" });
    registerIcon("test-retoned-glyph", "<path />");

    assert.equal(iconTone("test-retoned-glyph"), null);
  });
});

describe("Icon.isIconTone", () => {
  test("accepts every declared tone and rejects anything else", () => {
    for (const tone of ICON_TONES) {
      assert.ok(isIconTone(tone));
    }

    assert.equal(isIconTone(""), false);
    assert.equal(isIconTone("magenta"), false);
  });
});
