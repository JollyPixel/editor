// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  naturalTabsWidth,
  tabLabelsFit
} from "../../../src/containers/pane-group/tabCompaction.ts";

describe("naturalTabsWidth", () => {
  test("adds back what each cut-off label is missing, plus the gaps", () => {
    const width = naturalTabsWidth([
      {
        tabWidth: 60,
        labelWidth: 30,
        labelContentWidth: 50,
        labelHidden: false,
        innerGap: 4
      },
      {
        tabWidth: 40,
        labelWidth: 20,
        labelContentWidth: 20,
        labelHidden: false,
        innerGap: 4
      }
    ], 1);

    assert.equal(width, 80 + 40 + 1);
  });

  test("adds back a hidden label and its gap, matching the expanded width", () => {
    const expanded = naturalTabsWidth([
      {
        tabWidth: 82,
        labelWidth: 50,
        labelContentWidth: 50,
        labelHidden: false,
        innerGap: 4
      }
    ], 1);
    const compact = naturalTabsWidth([
      {
        tabWidth: 28,
        labelWidth: 1,
        labelContentWidth: 50,
        labelHidden: true,
        innerGap: 4
      }
    ], 1);

    assert.equal(compact, 82);
    assert.equal(compact, expanded);
  });

  test("is zero without tabs", () => {
    assert.equal(naturalTabsWidth([], 1), 0);
  });
});

describe("tabLabelsFit", () => {
  test("fits up to the available width, tolerating subpixel rounding", () => {
    assert.equal(tabLabelsFit(200.4, 200), true);
    assert.equal(tabLabelsFit(201, 200), false);
  });
});
