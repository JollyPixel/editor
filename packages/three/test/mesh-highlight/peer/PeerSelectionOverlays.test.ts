// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  MeshHighlightState,
  PeerSelectionRegistry,
  PeerSelectionOverlays,
  PeerSelectionVisibility,
  HighlightOutline
} from "#src/index.ts";
import {
  createFrontCamera,
  createPeerScene
} from "./helpers.ts";

function createHarness(
  options?: { visibility?: boolean; }
): {
  selection: MeshHighlightState;
  registry: PeerSelectionRegistry;
  overlays: PeerSelectionOverlays;
  visibility: PeerSelectionVisibility | undefined;
  mesh: THREE.Mesh;
} {
  const { selection, registry, mesh } = createPeerScene();

  const visibility = options?.visibility ?
    new PeerSelectionVisibility({
      registry,
      selection,
      camera: createFrontCamera()
    }) :
    undefined;

  const overlays = new PeerSelectionOverlays({
    registry,
    selection,
    visibility
  });

  return {
    selection,
    registry,
    overlays,
    visibility,
    mesh
  };
}

function colorOf(
  mesh: THREE.Mesh
): string {
  const overlay = mesh.children[0] as THREE.LineSegments;
  const material = overlay.material as THREE.LineBasicMaterial;

  return `#${material.color.getHexString()}`;
}

describe("peer selection", () => {
  test("one peer selecting a registered mesh produces exactly one overlay in its color", () => {
    const { registry, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");

    assert.strictEqual(mesh.children.length, 1);
    assert.ok("material" in mesh.children[0]);
    assert.strictEqual(colorOf(mesh), registry.colorOf("peer-a"));
  });

  test(
    "a second peer on the same object still produces exactly one overlay, in the first peer's color",
    () => {
      const { registry, mesh } = createHarness();
      registry.select("peer-a", "mesh-1");
      registry.select("peer-b", "mesh-1");

      assert.strictEqual(mesh.children.length, 1);
      assert.strictEqual(colorOf(mesh), registry.colorOf("peer-a"));
    }
  );

  test("the primary peer deselecting updates the same overlay instance to the next peer's color", () => {
    const { registry, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    const overlayBefore = mesh.children[0];

    registry.select("peer-a", null);

    assert.strictEqual(mesh.children.length, 1);
    assert.strictEqual(
      mesh.children[0],
      overlayBefore,
      "must reuse the same overlay instance, not rebuild it"
    );
    assert.strictEqual(colorOf(mesh), registry.colorOf("peer-b"));
  });

  test("all peers deselecting disposes the overlay", () => {
    const { registry, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-a", null);

    assert.strictEqual(mesh.children.length, 0);
  });

  test("a local selection on the same object suppresses the peer overlay", () => {
    const { registry, selection, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    selection.select("mesh-1");

    assert.strictEqual(mesh.children.length, 1, "only the local selection overlay should remain");
  });

  test("deselecting locally restores the peer overlay", () => {
    const { registry, selection, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    selection.select("mesh-1");
    selection.select(null);

    assert.strictEqual(mesh.children.length, 1);
    assert.strictEqual(colorOf(mesh), registry.colorOf("peer-a"));
  });

  test("falls back to \"outline\" for an id resolved to a scene-pipeline technique", () => {
    for (const technique of ["highlight", "highlightJfa"] as const) {
      const { registry, selection, mesh } = createHarness();
      selection.technique = technique;

      registry.select("peer-a", "mesh-1");

      assert.strictEqual(mesh.children.length, 1, technique);
      assert.ok(mesh.children[0] instanceof HighlightOutline, technique);
    }
  });

  test("a peer selection that already existed before construction renders immediately", () => {
    const { selection, registry, mesh } = createPeerScene();
    registry.select("peer-a", "mesh-1");

    new PeerSelectionOverlays({ registry, selection });

    assert.strictEqual(mesh.children.length, 1);
    assert.strictEqual(colorOf(mesh), registry.colorOf("peer-a"));
  });

  test("an xray change applies x-ray to peer overlays", () => {
    const { registry, selection, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    const materialBefore = (mesh.children[0] as THREE.LineSegments).material as THREE.LineBasicMaterial;
    assert.strictEqual(materialBefore.depthTest, true, "starts non-x-ray");

    selection.configure({ xray: true });

    const material = (mesh.children[0] as THREE.LineSegments)
      .material as THREE.LineBasicMaterial;
    assert.strictEqual(material.depthTest, false, "x-ray disables depth test");
  });
});

describe("visibility", () => {
  test("suppresses the peer overlay for an object visibility reports not visible", () => {
    const { registry, visibility, mesh } = createHarness({ visibility: true });
    mesh.position.set(0, 0, 10);
    registry.select("peer-a", "mesh-1");
    visibility!.update();

    assert.strictEqual(mesh.children.length, 0);
  });

  test("shows the peer overlay once visibility reports it visible again", () => {
    const { registry, visibility, mesh } = createHarness({ visibility: true });
    mesh.position.set(0, 0, 10);
    registry.select("peer-a", "mesh-1");
    visibility!.update();
    assert.strictEqual(mesh.children.length, 0);

    mesh.position.set(0, 0, -10);
    visibility!.update();

    assert.strictEqual(mesh.children.length, 1);
  });
});

describe("dispose", () => {
  test("removes all peer overlays and detaches listeners", () => {
    const { registry, overlays, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    overlays.dispose();

    assert.strictEqual(mesh.children.length, 0);

    registry.select("peer-b", "mesh-1");
    assert.strictEqual(mesh.children.length, 0, "must stop reacting to registry changes after dispose");
  });
});
