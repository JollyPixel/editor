// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  SelectionManager,
  PeerSelectionRegistry,
  PeerHoverRegistry,
  PeerSelectionVisibility
} from "#src/index.ts";

/**
 * Camera at the origin looking down -Z, matching this file's own targets:
 * `(0, 0, -10)` sits well inside the frustum and near plane/far plane range,
 * `(0, 0, 10)` sits directly behind the camera (outside any frustum
 * regardless of fov), `(50, 0, -10)` sits far enough off-axis at that depth
 * to fall outside a 50deg fov frustum.
 */
function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  camera.updateMatrixWorld();

  return camera;
}

function createHarness(
  options?: { maxDistance?: number; }
): {
  selection: SelectionManager;
  registry: PeerSelectionRegistry;
  camera: THREE.PerspectiveCamera;
  visibility: PeerSelectionVisibility;
  mesh: THREE.Mesh;
} {
  const selection = new SelectionManager();
  const registry = new PeerSelectionRegistry();
  const camera = createCamera();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  selection.register("mesh-1", mesh);

  const visibility = new PeerSelectionVisibility({
    registry, selection, camera, maxDistance: options?.maxDistance
  });

  return { selection, registry, camera, visibility, mesh };
}

describe("isVisible", () => {
  test("defaults to true for an id update() has never seen", () => {
    const { visibility } = createHarness();

    assert.strictEqual(visibility.isVisible("unknown"), true);
  });

  test("true for a peer-selected object inside the frustum", () => {
    const { registry, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, -10);
    registry.select("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), true);
  });

  test("false for a peer-selected object behind the camera", () => {
    const { registry, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, 10);
    registry.select("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), false);
  });

  test("false for a peer-selected object outside the frustum's field of view", () => {
    const { registry, visibility, mesh } = createHarness();
    mesh.position.set(50, 0, -10);
    registry.select("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), false);
  });

  test("not gated by distance when maxDistance is left at its Infinity default", () => {
    const { registry, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, -900);
    registry.select("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), true);
  });

  test("false for a peer-selected object beyond maxDistance, even inside the frustum", () => {
    const { registry, visibility, mesh } = createHarness({ maxDistance: 20 });
    mesh.position.set(0, 0, -50);
    registry.select("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), false);
  });

  test("true for a peer-selected object within maxDistance", () => {
    const { registry, visibility, mesh } = createHarness({ maxDistance: 20 });
    mesh.position.set(0, 0, -10);
    registry.select("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), true);
  });
});

describe("hoverRegistry", () => {
  function createHoverHarness(): {
    registry: PeerSelectionRegistry;
    hoverRegistry: PeerHoverRegistry;
    visibility: PeerSelectionVisibility;
    mesh: THREE.Mesh;
  } {
    const selection = new SelectionManager();
    const registry = new PeerSelectionRegistry();
    const hoverRegistry = new PeerHoverRegistry();
    const camera = createCamera();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    selection.register("mesh-1", mesh);

    const visibility = new PeerSelectionVisibility({ registry, selection, camera, hoverRegistry });

    return { registry, hoverRegistry, visibility, mesh };
  }

  test("true for a peer-hovered-only object inside the frustum", () => {
    const { hoverRegistry, visibility, mesh } = createHoverHarness();
    mesh.position.set(0, 0, -10);
    hoverRegistry.hover("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), true);
  });

  test("false for a peer-hovered-only object behind the camera", () => {
    const { hoverRegistry, visibility, mesh } = createHoverHarness();
    mesh.position.set(0, 0, 10);
    hoverRegistry.hover("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), false);
  });

  test("still evaluates a selected object with no hoverer, unaffected by the union", () => {
    const { registry, visibility, mesh } = createHoverHarness();
    mesh.position.set(0, 0, 10);
    registry.select("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), false);
  });

  test("omitting hoverRegistry preserves selection-only behavior for a hover-only id", () => {
    const selection = new SelectionManager();
    const registry = new PeerSelectionRegistry();
    const hoverRegistry = new PeerHoverRegistry();
    const camera = createCamera();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    selection.register("mesh-1", mesh);
    mesh.position.set(0, 0, 10);

    // No `hoverRegistry` passed here - a hover-only id (no selector) is
    // never added to the tracked set, so `update()` never evaluates it,
    // regardless of the peer hover state a caller happens to track
    // elsewhere.
    const visibility = new PeerSelectionVisibility({ registry, selection, camera });
    hoverRegistry.hover("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), true, "falls back to the default, never evaluated");
  });
});

describe("camera and maxDistance", () => {
  test("maxDistance changes the cutoff applied on the next update()", () => {
    const { registry, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, -50);
    registry.select("peer-a", "mesh-1");
    visibility.update();
    assert.strictEqual(visibility.isVisible("mesh-1"), true);

    visibility.maxDistance = 20;
    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), false);
  });

  test("camera changes which camera update() tests against", () => {
    const { registry, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, -10);
    registry.select("peer-a", "mesh-1");
    visibility.update();
    assert.strictEqual(visibility.isVisible("mesh-1"), true);

    const behindCamera = createCamera();
    behindCamera.position.set(0, 0, -100);
    behindCamera.lookAt(0, 0, -200);
    behindCamera.updateMatrixWorld();
    visibility.camera = behindCamera;
    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), false);
  });
});

describe("visibilityChange", () => {
  test("dispatches when update() flips a tracked id's visibility", () => {
    const { registry, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, -10);
    registry.select("peer-a", "mesh-1");
    visibility.update();

    let dispatched = false;
    visibility.addEventListener("visibilityChange", () => {
      dispatched = true;
    });
    mesh.position.set(0, 0, 10);
    visibility.update();

    assert.ok(dispatched);
    assert.strictEqual(visibility.isVisible("mesh-1"), false);
  });

  test("does not dispatch when nothing changed", () => {
    const { registry, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, -10);
    registry.select("peer-a", "mesh-1");
    visibility.update();

    let dispatched = false;
    visibility.addEventListener("visibilityChange", () => {
      dispatched = true;
    });
    visibility.update();

    assert.strictEqual(dispatched, false);
  });

  test("does not dispatch merely because a tracked id is no longer peer-selected", () => {
    const { registry, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, -10);
    registry.select("peer-a", "mesh-1");
    visibility.update();

    let dispatched = false;
    visibility.addEventListener("visibilityChange", () => {
      dispatched = true;
    });
    registry.select("peer-a", null);
    visibility.update();

    assert.strictEqual(dispatched, false);
  });
});

describe("dispose", () => {
  test("clears tracked state - isVisible falls back to its default true", () => {
    const { registry, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, 10);
    registry.select("peer-a", "mesh-1");
    visibility.update();
    assert.strictEqual(visibility.isVisible("mesh-1"), false);

    visibility.dispose();

    assert.strictEqual(visibility.isVisible("mesh-1"), true);
  });
});
