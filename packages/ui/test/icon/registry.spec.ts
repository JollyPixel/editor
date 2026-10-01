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
  DEFAULT_ICON_VIEW_BOX,
  ICON_TONES,
  getIcon,
  iconTone,
  iconViewBox,
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

  test("records the view box of a glyph drawn on another grid", () => {
    registerIcon("test-wide-glyph", "<path />", { viewBox: "0 0 64 64" });

    assert.equal(iconViewBox("test-wide-glyph"), "0 0 64 64");
  });

  test("falls back to the default view box", () => {
    registerIcon("test-default-grid-glyph", "<path />");

    assert.equal(
      iconViewBox("test-default-grid-glyph"),
      DEFAULT_ICON_VIEW_BOX
    );
    assert.equal(
      iconViewBox("test-never-registered"),
      DEFAULT_ICON_VIEW_BOX
    );
  });

  test("drops the view box when a glyph is registered again without one", () => {
    registerIcon("test-regridded-glyph", "<path />", { viewBox: "0 0 64 64" });
    registerIcon("test-regridded-glyph", "<path />");

    assert.equal(iconViewBox("test-regridded-glyph"), DEFAULT_ICON_VIEW_BOX);
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
