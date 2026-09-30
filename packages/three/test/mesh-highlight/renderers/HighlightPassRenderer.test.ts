// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  HighlightPassRenderer,
  MeshHighlightAppearance,
  type HighlightEntry,
  type HighlightPassTarget
} from "#src/index.ts";
import {
  CAMERA,
  createRegistry,
  indicator,
  type TestOverlay
} from "./helpers.ts";

class TestHighlight implements HighlightPassTarget {
  entries: HighlightEntry[] = [];
  renderCount = 0;
  disposeCount = 0;

  render(): void {
    this.renderCount += 1;
  }

  dispose(): void {
    this.disposeCount += 1;
  }
}

describe("HighlightPassRenderer", () => {
  test("routes scene techniques and object techniques independently", () => {
    const overlays: TestOverlay[] = [];
    const highlight = new TestHighlight();
    const renderer = new HighlightPassRenderer({
      highlight,
      overlayRegistry: createRegistry(overlays),
      camera: CAMERA
    });
    const highlighted = new THREE.Mesh();
    const outlined = new THREE.Mesh();
    const group = new THREE.Group();

    renderer.sync([
      indicator(highlighted, {
        objectId: "highlighted",
        technique: "highlight"
      }),
      indicator(outlined, {
        objectId: "outlined"
      }),
      indicator(group, {
        objectId: "group",
        technique: "highlight"
      })
    ], new MeshHighlightAppearance());

    assert.deepStrictEqual(
      highlight.entries.map(({ target }) => target),
      [highlighted]
    );
    assert.strictEqual(overlays.length, 2);
  });

  test("gives the local selection priority, isolates hovers and darkens a peer's hover", () => {
    const highlight = new TestHighlight();
    const renderer = new HighlightPassRenderer({
      highlight,
      overlayRegistry: createRegistry([]),
      camera: CAMERA
    });

    renderer.sync([
      indicator(new THREE.Mesh(), {
        objectId: "local",
        technique: "highlight"
      }),
      indicator(new THREE.Mesh(), {
        objectId: "peer",
        technique: "highlight",
        source: "peer"
      }),
      indicator(new THREE.Mesh(), {
        objectId: "hovered",
        technique: "highlight",
        role: "hover",
        source: "peer"
      })
    ], new MeshHighlightAppearance());

    assert.deepStrictEqual(
      highlight.entries.map(({ priority, isolated }) => {
        return { priority, isolated };
      }),
      [
        { priority: true, isolated: false },
        { priority: false, isolated: false },
        { priority: false, isolated: true }
      ]
    );
    assert.strictEqual(highlight.entries[1].color, "#ffffff");
    assert.ok(new THREE.Color(highlight.entries[2].color).r < 1);
  });

  test("owns rendering and disposal of both strategies", () => {
    const overlays: TestOverlay[] = [];
    const highlight = new TestHighlight();
    const renderer = new HighlightPassRenderer({
      highlight,
      overlayRegistry: createRegistry(overlays),
      camera: CAMERA
    });
    renderer.sync([
      indicator(new THREE.Group())
    ], new MeshHighlightAppearance());

    renderer.render();
    renderer.dispose();

    assert.strictEqual(highlight.renderCount, 1);
    assert.strictEqual(highlight.disposeCount, 1);
    assert.strictEqual(overlays[0].disposeCount, 1);
  });
});
