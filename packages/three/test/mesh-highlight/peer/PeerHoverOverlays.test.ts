// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  MeshHighlightState,
  PeerSelectionRegistry,
  PeerHoverRegistry,
  PeerHoverOverlays,
  PeerSelectionVisibility
} from "#src/index.ts";
import {
  createFrontCamera,
  createPeerScene
} from "./helpers.ts";

function createHarness(
  options?: { visibility?: boolean; opacity?: number; }
): {
  selection: MeshHighlightState;
  selectionRegistry: PeerSelectionRegistry;
  hoverRegistry: PeerHoverRegistry;
  overlays: PeerHoverOverlays;
  visibility: PeerSelectionVisibility | undefined;
  mesh: THREE.Mesh;
} {
  const { selection, registry: selectionRegistry, mesh } = createPeerScene();
  const hoverRegistry = new PeerHoverRegistry();

  const visibility = options?.visibility ?
    new PeerSelectionVisibility({
      registry: selectionRegistry,
      selection,
      camera: createFrontCamera(),
      hoverRegistry
    }) :
    undefined;

  const overlays = new PeerHoverOverlays({
    selectionRegistry,
    hoverRegistry,
    selection,
    visibility,
    opacity: options?.opacity
  });

  return {
    selection,
    selectionRegistry,
    hoverRegistry,
    overlays,
    visibility,
    mesh
  };
}

function materialOf(
  mesh: THREE.Mesh
): THREE.LineBasicMaterial {
  return (mesh.children[0] as THREE.LineSegments).material as THREE.LineBasicMaterial;
}

function colorOf(
  mesh: THREE.Mesh
): string {
  return `#${materialOf(mesh).color.getHexString()}`;
}

describe("peer hover", () => {
  test("one peer hovering a registered mesh produces exactly one dashed overlay in its color", () => {
    const { hoverRegistry, mesh } = createHarness();
    hoverRegistry.hover("peer-a", "mesh-1");

    assert.strictEqual(mesh.children.length, 1);
    assert.ok(materialOf(mesh) instanceof THREE.LineDashedMaterial);
    assert.strictEqual(colorOf(mesh), hoverRegistry.colorOf("peer-a"));
  });

  test("defaults to the documented 0.35 hover opacity", () => {
    const { hoverRegistry, mesh } = createHarness();
    hoverRegistry.hover("peer-a", "mesh-1");

    assert.strictEqual(materialOf(mesh).opacity, 0.35);
  });

  test("a custom opacity is applied to the overlay", () => {
    const { hoverRegistry, mesh } = createHarness({ opacity: 0.7 });
    hoverRegistry.hover("peer-a", "mesh-1");

    assert.strictEqual(materialOf(mesh).opacity, 0.7);
  });

  test(
    "a second peer on the same object still produces exactly one overlay, in the first peer's color",
    () => {
      const { hoverRegistry, mesh } = createHarness();
      hoverRegistry.hover("peer-a", "mesh-1");
      hoverRegistry.hover("peer-b", "mesh-1");

      assert.strictEqual(mesh.children.length, 1);
      assert.strictEqual(colorOf(mesh), hoverRegistry.colorOf("peer-a"));
    }
  );

  test("the primary peer un-hovering updates the same overlay instance to the next peer's color", () => {
    const { hoverRegistry, mesh } = createHarness();
    hoverRegistry.hover("peer-a", "mesh-1");
    hoverRegistry.hover("peer-b", "mesh-1");
    const overlayBefore = mesh.children[0];

    hoverRegistry.hover("peer-a", null);

    assert.strictEqual(
      mesh.children[0],
      overlayBefore,
      "must reuse the same overlay instance, not rebuild it"
    );
    assert.strictEqual(colorOf(mesh), hoverRegistry.colorOf("peer-b"));
  });

  test("all peers un-hovering disposes the overlay", () => {
    const { hoverRegistry, mesh } = createHarness();
    hoverRegistry.hover("peer-a", "mesh-1");
    hoverRegistry.hover("peer-a", null);

    assert.strictEqual(mesh.children.length, 0);
  });

  test("a peer hover that already existed before construction renders immediately", () => {
    const { selection, registry: selectionRegistry, mesh } = createPeerScene();
    const hoverRegistry = new PeerHoverRegistry();
    hoverRegistry.hover("peer-a", "mesh-1");

    new PeerHoverOverlays({ selectionRegistry, hoverRegistry, selection });

    assert.strictEqual(mesh.children.length, 1);
    assert.strictEqual(colorOf(mesh), hoverRegistry.colorOf("peer-a"));
  });
});

describe("priority rule: any selector suppresses hover", () => {
  test("a peer selection on the object suppresses another peer's hover overlay", () => {
    const { selectionRegistry, hoverRegistry, mesh } = createHarness();
    hoverRegistry.hover("peer-a", "mesh-1");
    selectionRegistry.select("peer-b", "mesh-1");

    assert.strictEqual(mesh.children.length, 0);
  });

  test("the local selection suppresses a peer's hover overlay", () => {
    const { selection, hoverRegistry, mesh } = createHarness();
    hoverRegistry.hover("peer-a", "mesh-1");
    selection.select("mesh-1");

    assert.strictEqual(mesh.children.length, 1, "only the local selection's own overlay should remain");
    assert.notStrictEqual(colorOf(mesh), hoverRegistry.colorOf("peer-a"));
  });

  test("the peer hover overlay reappears once the selector clears", () => {
    const { selection, hoverRegistry, mesh } = createHarness();
    hoverRegistry.hover("peer-a", "mesh-1");
    selection.select("mesh-1");
    selection.select(null);

    assert.strictEqual(mesh.children.length, 1);
  });
});

describe("priority rule: local hover wins over peer hover", () => {
  test("local hover on the object suppresses a peer's hover overlay", () => {
    const { selection, hoverRegistry, mesh } = createHarness();
    hoverRegistry.hover("peer-a", "mesh-1");
    selection.hover("mesh-1");

    assert.strictEqual(mesh.children.length, 1, "only the local hover's own overlay should remain");
    assert.notStrictEqual(colorOf(mesh), hoverRegistry.colorOf("peer-a"));
  });

  test("the peer hover overlay reappears once the local hover moves away", () => {
    const { selection, hoverRegistry, mesh } = createHarness();
    hoverRegistry.hover("peer-a", "mesh-1");
    selection.hover("mesh-1");
    selection.hover(null);

    assert.strictEqual(mesh.children.length, 1);
  });
});

describe("visibility", () => {
  test("suppresses the peer hover overlay for an object visibility reports not visible", () => {
    const { hoverRegistry, visibility, mesh } = createHarness({ visibility: true });
    mesh.position.set(0, 0, 10);
    hoverRegistry.hover("peer-a", "mesh-1");
    visibility!.update();

    assert.strictEqual(mesh.children.length, 0);
  });

  test("shows the peer hover overlay once visibility reports it visible again", () => {
    const { hoverRegistry, visibility, mesh } = createHarness({ visibility: true });
    mesh.position.set(0, 0, 10);
    hoverRegistry.hover("peer-a", "mesh-1");
    visibility!.update();
    assert.strictEqual(mesh.children.length, 0);

    mesh.position.set(0, 0, -10);
    visibility!.update();

    assert.strictEqual(mesh.children.length, 1);
  });
});

describe("dispose", () => {
  test("removes all peer hover overlays and detaches listeners", () => {
    const { hoverRegistry, overlays, mesh } = createHarness();
    hoverRegistry.hover("peer-a", "mesh-1");
    overlays.dispose();

    assert.strictEqual(mesh.children.length, 0);

    hoverRegistry.hover("peer-b", "mesh-1");
    assert.strictEqual(mesh.children.length, 0, "must stop reacting to registry changes after dispose");
  });
});
