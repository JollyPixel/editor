// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  extractSize
} from "../../../src/containers/dock/extractSize.ts";

// CONSTANTS
const kMeasured = {
  width: 260,
  height: 400
};
const kHidden = {
  width: 0,
  height: 0
};
const kGroup = {
  width: 260,
  height: 600
};

describe("extractSize", () => {
  test("uses the measured size of a rendered pane", () => {
    assert.deepEqual(extractSize({
      preferred: {},
      measured: kMeasured,
      fallback: kGroup
    }), kMeasured);
  });

  test("falls back when the pane is not rendered", () => {
    assert.deepEqual(extractSize({
      preferred: {},
      measured: kHidden,
      fallback: kGroup
    }), kGroup);
  });

  test("prefers the declared float size per axis", () => {
    assert.deepEqual(extractSize({
      preferred: {
        width: 320
      },
      measured: kHidden,
      fallback: kGroup
    }), {
      width: 320,
      height: 600
    });
  });

  test("a remembered window size wins over everything", () => {
    assert.deepEqual(extractSize({
      remembered: {
        x: 10,
        y: 10,
        width: 200,
        height: 150
      },
      preferred: {
        width: 320,
        height: 480
      },
      measured: kMeasured,
      fallback: kGroup
    }), {
      width: 200,
      height: 150
    });
  });

  test("never goes below the minimum window size", () => {
    assert.deepEqual(extractSize({
      preferred: {},
      measured: kHidden,
      fallback: kHidden
    }), {
      width: 160,
      height: 80
    });
  });
});
