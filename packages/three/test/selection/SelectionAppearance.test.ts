// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { SelectionAppearance } from "#src/index.ts";

describe("SelectionAppearance", () => {
  test("provides one immutable set of renderer defaults", () => {
    const appearance = new SelectionAppearance();

    assert.strictEqual(appearance.selected.color, "#ffffff");
    assert.strictEqual(appearance.selected.opacity, 1);
    assert.strictEqual(appearance.hovered.color, "#8ab4f8");
    assert.strictEqual(appearance.hovered.opacity, 0.35);
    assert.strictEqual(appearance.outline.linewidth, 1);
    assert.strictEqual(appearance.bounds.fillOpacity, 0);
    assert.strictEqual(appearance.highlight.edgeThickness, 1);
    assert.strictEqual(appearance.highlightJfa.ringThickness, 2);
    assert.strictEqual(appearance.xray, false);
    assert.ok(Object.isFrozen(appearance));
    assert.ok(Object.isFrozen(appearance.selected));
  });

  test("with returns a new value and preserves unspecified fields", () => {
    const current = new SelectionAppearance({
      selected: {
        color: "#ff0000"
      },
      outline: {
        linewidth: 3
      }
    });

    const next = current.with({
      hovered: {
        opacity: 0.6
      }
    });

    assert.notStrictEqual(next, current);
    assert.strictEqual(next.selected.color, "#ff0000");
    assert.strictEqual(next.outline.linewidth, 3);
    assert.strictEqual(next.hovered.opacity, 0.6);
    assert.strictEqual(current.hovered.opacity, 0.35);
  });

  test("copies mutable colors at the boundary", () => {
    const input = new THREE.Color("#ff0000");
    const appearance = new SelectionAppearance({
      selected: {
        color: input
      }
    });

    input.set("#00ff00");

    const stored = appearance.selected.color as THREE.Color;
    assert.strictEqual(stored.getHexString(), "ff0000");
    assert.notStrictEqual(stored, input);
  });

  test("normalizes opacity and rejects invalid dimensions", () => {
    assert.strictEqual(
      new SelectionAppearance({
        hovered: {
          opacity: 2
        }
      }).hovered.opacity,
      1
    );
    assert.throws(
      () => new SelectionAppearance({
        outline: {
          linewidth: 0
        }
      }),
      RangeError
    );
    assert.throws(
      () => new SelectionAppearance({
        highlightJfa: {
          borderThickness: -1
        }
      }),
      RangeError
    );
  });
});
