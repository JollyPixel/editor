// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { MeshHighlightAppearance } from "#src/index.ts";

describe("MeshHighlightAppearance", () => {
  test("provides one immutable set of renderer defaults", () => {
    const appearance = new MeshHighlightAppearance();

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
    const current = new MeshHighlightAppearance({
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

  test("with preserves renderOrder and xrayDepthWrite", () => {
    const current = new MeshHighlightAppearance({ renderOrder: 42, xrayDepthWrite: true });
    const next = current.with({ xray: true });

    assert.strictEqual(new MeshHighlightAppearance().renderOrder, null);
    assert.strictEqual(new MeshHighlightAppearance().xrayDepthWrite, false);
    assert.strictEqual(next.renderOrder, 42);
    assert.strictEqual(next.xrayDepthWrite, true);
  });

  test("copies mutable colors at the boundary", () => {
    const input = new THREE.Color("#ff0000");
    const appearance = new MeshHighlightAppearance({
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
      new MeshHighlightAppearance({
        hovered: {
          opacity: 2
        }
      }).hovered.opacity,
      1
    );
    assert.throws(
      () => new MeshHighlightAppearance({
        outline: {
          linewidth: 0
        }
      }),
      RangeError
    );
    assert.throws(
      () => new MeshHighlightAppearance({
        highlightJfa: {
          borderThickness: -1
        }
      }),
      RangeError
    );
  });
});
