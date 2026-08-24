// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  SelectionManager,
  PeerSelectionRegistry,
  PeerSelectionOverlays,
  PeerSelectionVisibility,
  SelectionOutline
} from "#src/index.ts";

function createHarness(
  options?: { visibility?: boolean; }
): {
  selection: SelectionManager;
  registry: PeerSelectionRegistry;
  overlays: PeerSelectionOverlays;
  visibility: PeerSelectionVisibility | undefined;
  camera: THREE.PerspectiveCamera | undefined;
  mesh: THREE.Mesh;
} {
  const selection = new SelectionManager();
  const registry = new PeerSelectionRegistry();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  selection.register("mesh-1", mesh);

  let camera: THREE.PerspectiveCamera | undefined;
  let visibility: PeerSelectionVisibility | undefined;
  if (options?.visibility) {
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld();
    visibility = new PeerSelectionVisibility({ registry, selection, camera });
  }

  const overlays = new PeerSelectionOverlays({ registry, selection, visibility });

  return {
    selection, registry, overlays, visibility, camera, mesh
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

  test("falls back to \"outline\" for an id resolved to the \"coloredOutline\" technique " +
    "- a peer overlay can't share a single pipeline across peers", () => {
    const { registry, selection, mesh } = createHarness();
    selection.setTechnique("coloredOutline");

    registry.select("peer-a", "mesh-1");

    assert.strictEqual(mesh.children.length, 1);
    assert.ok(mesh.children[0] instanceof SelectionOutline);
  });
});

describe("visibility", () => {
  test("suppresses the peer overlay for an object visibility reports not visible", () => {
    const { registry, visibility, mesh } = createHarness({ visibility: true });
    // Behind the camera.
    mesh.position.set(0, 0, 10);
    // `update()` only evaluates currently peer-selected ids (see its own doc
    // comment), so the selection must exist first - registers with the
    // default "unseen" visible=true, then this `update()` evaluates it for
    // real (a flip, since nothing was tracked yet) and dispatches
    // `visibilityChange`, which re-runs `#refresh` and picks up the result.
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

    // Back in front of the camera.
    mesh.position.set(0, 0, -10);
    // Dispatches visibilityChange, which re-checks every selected id.
    visibility!.update();

    assert.strictEqual(mesh.children.length, 1);
  });

  test("never suppresses the local selection's own overlay", () => {
    const { selection, visibility, mesh } = createHarness({ visibility: true });
    // Behind the camera.
    mesh.position.set(0, 0, 10);
    visibility!.update();

    selection.select("mesh-1");

    assert.strictEqual(mesh.children.length, 1, "local selection must render regardless of camera visibility");
  });

  test("omitting visibility preserves always-visible behavior", () => {
    const { registry, mesh } = createHarness();
    registry.select("peer-a", "mesh-1");

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
