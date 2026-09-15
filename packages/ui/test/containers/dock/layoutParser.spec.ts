// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  emptyLayout,
  type LayoutSnapshot
} from "../../../src/containers/dock/layout.ts";
import {
  parseLayout,
  serializeLayout
} from "../../../src/containers/dock/layoutParser.ts";

describe("Containers.parseLayout", () => {
  test("returns null for absent or empty input", () => {
    assert.equal(parseLayout(null), null);
    assert.equal(parseLayout(""), null);
  });

  test("returns null for malformed JSON", () => {
    assert.equal(parseLayout("{ not json"), null);
  });

  test("returns null for a foreign version", () => {
    assert.equal(
      parseLayout(JSON.stringify({ v: 99, docks: {} })),
      null
    );
  });

  test("survives a payload missing every section", () => {
    assert.deepEqual(
      parseLayout(JSON.stringify({ v: 1 })),
      emptyLayout()
    );
  });

  test("drops non-finite geometry instead of storing NaN", () => {
    const parsed = parseLayout(JSON.stringify({
      v: 1,
      docks: {
        left: {
          size: "wide",
          groups: [
            {
              panes: ["a"],
              active: "a"
            }
          ]
        }
      },
      floating: {
        b: {
          x: 10,
          y: null
        }
      },
      panes: {}
    }));

    assert.deepEqual(parsed?.docks.left, {
      collapsed: false,
      groups: [
        {
          panes: ["a"],
          active: "a"
        }
      ]
    });
    assert.deepEqual(parsed?.floating.b, { x: 10 });
  });

  test("keeps only string entries in a pane list", () => {
    const parsed = parseLayout(JSON.stringify({
      v: 1,
      docks: {
        left: {
          groups: [
            {
              panes: ["a", 7, null, "b"],
              active: 7
            },
            {
              panes: [null]
            },
            "c"
          ]
        }
      }
    }));

    assert.deepEqual(parsed?.docks.left.groups, [
      {
        panes: ["a", "b"],
        active: "a"
      }
    ]);
  });

  test("ignores a dock stored without groups", () => {
    const parsed = parseLayout(JSON.stringify({
      v: 1,
      docks: {
        left: {
          panes: ["a"]
        }
      }
    }));

    assert.deepEqual(parsed?.docks.left.groups, []);
  });

  test("round-trips a serialized snapshot", () => {
    const snapshot: LayoutSnapshot = {
      ...emptyLayout(),
      docks: {
        left: {
          size: 240,
          collapsed: false,
          groups: [
            {
              panes: ["hierarchy"],
              active: "hierarchy"
            }
          ]
        }
      },
      floating: {
        assets: {
          x: 20,
          y: 30,
          width: 320,
          height: 400
        }
      },
      panes: {
        hierarchy: {
          collapsed: true
        }
      }
    };

    assert.deepEqual(
      parseLayout(serializeLayout(snapshot)),
      snapshot
    );
  });
});
