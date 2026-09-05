// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  HighlightSelectionRenderer,
  ObjectOverlaySelectionRenderer,
  SelectionAppearance,
  SelectionOverlayRegistry,
  type HighlightEntry,
  type ResolvedSelectionIndicator,
  type SelectionHighlightTarget,
  type SelectionOverlay
} from "#src/index.ts";

class TestOverlay implements SelectionOverlay {
  color: THREE.ColorRepresentation;
  opacity: number;
  xray: boolean;
  fillOpacity = 0;
  linewidth = 1;
  disposeCount = 0;

  constructor(
    color: THREE.ColorRepresentation,
    opacity: number,
    xray: boolean
  ) {
    this.color = color;
    this.opacity = opacity;
    this.xray = xray;
  }

  dispose(): void {
    this.disposeCount += 1;
  }
}

function createRegistry(
  overlays: TestOverlay[]
): SelectionOverlayRegistry {
  const registry = new SelectionOverlayRegistry({
    defaultId: "outline",
    fallbackId: "outline"
  });
  for (const id of ["outline", "custom", "boundingBox"]) {
    registry.register({
      id,
      supports: () => true,
      create: (_target, options) => {
        const overlay = new TestOverlay(
          options.color,
          options.opacity,
          options.xray
        );
        overlays.push(overlay);

        return overlay;
      }
    });
  }

  return registry;
}

function indicator(
  target: THREE.Object3D,
  options: Partial<ResolvedSelectionIndicator> = {}
): ResolvedSelectionIndicator {
  return {
    objectId: "object",
    target,
    role: "selection",
    source: "local",
    color: "#ffffff",
    opacity: 1,
    technique: "outline",
    ...options
  };
}

describe("ObjectOverlaySelectionRenderer", () => {
  test("updates a compatible overlay in place", () => {
    const overlays: TestOverlay[] = [];
    const renderer = new ObjectOverlaySelectionRenderer({
      registry: createRegistry(overlays),
      renderScene: () => void 0
    });
    const target = new THREE.Mesh();
    const appearance = new SelectionAppearance();
    renderer.sync([indicator(target)], appearance);

    renderer.sync([
      indicator(target, {
        color: "#ff0000",
        opacity: 0.5
      })
    ], appearance.with({
      outline: {
        linewidth: 4
      },
      xray: true
    }));

    assert.strictEqual(overlays.length, 1);
    assert.strictEqual(overlays[0].color, "#ff0000");
    assert.strictEqual(overlays[0].opacity, 0.5);
    assert.strictEqual(overlays[0].linewidth, 4);
    assert.strictEqual(overlays[0].xray, true);
  });

  test("replaces incompatible overlays and disposes removed ones", () => {
    const overlays: TestOverlay[] = [];
    const renderer = new ObjectOverlaySelectionRenderer({
      registry: createRegistry(overlays),
      renderScene: () => void 0
    });
    const target = new THREE.Mesh();
    const appearance = new SelectionAppearance();
    renderer.sync([indicator(target)], appearance);

    renderer.sync([
      indicator(target, {
        technique: "custom"
      })
    ], appearance);
    renderer.sync([], appearance);

    assert.strictEqual(overlays.length, 2);
    assert.strictEqual(overlays[0].disposeCount, 1);
    assert.strictEqual(overlays[1].disposeCount, 1);
  });
});

class TestHighlight implements SelectionHighlightTarget {
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

describe("HighlightSelectionRenderer", () => {
  test("routes scene techniques and object techniques independently", () => {
    const overlays: TestOverlay[] = [];
    const highlight = new TestHighlight();
    const renderer = new HighlightSelectionRenderer({
      highlight,
      overlayRegistry: createRegistry(overlays)
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
    ], new SelectionAppearance());

    assert.deepStrictEqual(
      highlight.entries.map(({ target }) => target),
      [highlighted]
    );
    assert.strictEqual(overlays.length, 2);
  });

  test("owns rendering and disposal of both strategies", () => {
    const overlays: TestOverlay[] = [];
    const highlight = new TestHighlight();
    const renderer = new HighlightSelectionRenderer({
      highlight,
      overlayRegistry: createRegistry(overlays)
    });
    renderer.sync([
      indicator(new THREE.Group())
    ], new SelectionAppearance());

    renderer.render();
    renderer.dispose();

    assert.strictEqual(highlight.renderCount, 1);
    assert.strictEqual(highlight.disposeCount, 1);
    assert.strictEqual(overlays[0].disposeCount, 1);
  });
});
