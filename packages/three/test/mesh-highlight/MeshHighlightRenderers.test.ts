// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  HighlightPassRenderer,
  ObjectOverlayRenderer,
  MeshHighlightAppearance,
  HighlightOverlayRegistry,
  type HighlightEntry,
  type ResolvedHighlightIndicator,
  type HighlightPassTarget,
  type HighlightOverlay
} from "#src/index.ts";

class TestOverlay implements HighlightOverlay {
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
): HighlightOverlayRegistry {
  const registry = new HighlightOverlayRegistry({
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
          options.xray ?? false
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
  options: Partial<ResolvedHighlightIndicator> = {}
): ResolvedHighlightIndicator {
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

describe("ObjectOverlayRenderer", () => {
  test("updates a compatible overlay in place", () => {
    const overlays: TestOverlay[] = [];
    const renderer = new ObjectOverlayRenderer({
      registry: createRegistry(overlays),
      renderScene: () => void 0
    });
    const target = new THREE.Mesh();
    const appearance = new MeshHighlightAppearance();
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
    const renderer = new ObjectOverlayRenderer({
      registry: createRegistry(overlays),
      renderScene: () => void 0
    });
    const target = new THREE.Mesh();
    const appearance = new MeshHighlightAppearance();
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
    ], new MeshHighlightAppearance());

    assert.deepStrictEqual(
      highlight.entries.map(({ target }) => target),
      [highlighted]
    );
    assert.strictEqual(overlays.length, 2);
  });

  test("owns rendering and disposal of both strategies", () => {
    const overlays: TestOverlay[] = [];
    const highlight = new TestHighlight();
    const renderer = new HighlightPassRenderer({
      highlight,
      overlayRegistry: createRegistry(overlays)
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
