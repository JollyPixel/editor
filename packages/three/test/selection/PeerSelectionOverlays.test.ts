// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { SelectionManager, PeerSelectionRegistry, PeerSelectionOverlays, SelectionOutline } from "#src/index.ts";

function createHarness(): {
  selection: SelectionManager;
  registry: PeerSelectionRegistry;
  overlays: PeerSelectionOverlays;
  mesh: THREE.Mesh;
} {
  const selection = new SelectionManager();
  const registry = new PeerSelectionRegistry();
  const overlays = new PeerSelectionOverlays({ registry, selection });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

  selection.register("mesh-1", mesh);

  return {
    selection, registry, overlays, mesh
  };
}

describe("peer selection", () => {
  test("one peer selecting a registered mesh produces exactly one overlay in its color", () => {
    const { registry, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");

    assert.strictEqual(mesh.children.length, 1);
    assert.ok("material" in mesh.children[0]);
    const material = (mesh.children[0] as THREE.LineSegments | THREE.Mesh).material as THREE.LineBasicMaterial;
    assert.strictEqual(`#${material.color.getHexString()}`, registry.colorOf("peer-a"));
  });

  test("a second peer on the same object still produces exactly one overlay, in the first peer's color", () => {
    const { registry, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");

    assert.strictEqual(mesh.children.length, 1);
    const material = (mesh.children[0] as THREE.LineSegments).material as THREE.LineBasicMaterial;
    assert.strictEqual(`#${material.color.getHexString()}`, registry.colorOf("peer-a"));
  });

  test("the primary peer deselecting updates the same overlay instance to the next peer's color", () => {
    const { registry, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");
    registry.select("peer-b", "mesh-1");
    const overlayBefore = mesh.children[0];

    registry.select("peer-a", null);

    assert.strictEqual(mesh.children.length, 1);
    assert.strictEqual(mesh.children[0], overlayBefore, "must reuse the same overlay instance, not rebuild it");
    const material = (mesh.children[0] as THREE.LineSegments).material as THREE.LineBasicMaterial;
    assert.strictEqual(`#${material.color.getHexString()}`, registry.colorOf("peer-b"));
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
    const material = (mesh.children[0] as THREE.LineSegments).material as THREE.LineBasicMaterial;
    assert.strictEqual(`#${material.color.getHexString()}`, registry.colorOf("peer-a"));
  });

  test("falls back to \"outline\" for an id resolved to the \"toonOutline\" style " +
    "- a peer overlay can't share a single pipeline across peers", () => {
    const { registry, selection, mesh } = createHarness();
    selection.setMeshStyle("toonOutline");

    registry.select("peer-a", "mesh-1");

    assert.strictEqual(mesh.children.length, 1);
    assert.ok(mesh.children[0] instanceof SelectionOutline);
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
