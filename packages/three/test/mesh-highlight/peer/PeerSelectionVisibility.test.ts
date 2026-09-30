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
  PeerSelectionVisibility
} from "#src/index.ts";
import {
  createFrontCamera,
  createPeerScene
} from "./helpers.ts";

function createHarness(
  options?: { maxDistance?: number; }
): {
  selection: MeshHighlightState;
  registry: PeerSelectionRegistry;
  camera: THREE.PerspectiveCamera;
  visibility: PeerSelectionVisibility;
  mesh: THREE.Mesh;
} {
  const { selection, registry, mesh } = createPeerScene();
  const camera = createFrontCamera();

  const visibility = new PeerSelectionVisibility({
    registry,
    selection,
    camera,
    maxDistance: options?.maxDistance
  });

  return {
    selection,
    registry,
    camera,
    visibility,
    mesh
  };
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
  function createHoverHarness(
    options?: { attached?: boolean; }
  ): {
    registry: PeerSelectionRegistry;
    hoverRegistry: PeerHoverRegistry;
    visibility: PeerSelectionVisibility;
    mesh: THREE.Mesh;
  } {
    const { selection, registry, mesh } = createPeerScene();
    const hoverRegistry = new PeerHoverRegistry();

    const visibility = new PeerSelectionVisibility({
      registry,
      selection,
      camera: createFrontCamera(),
      hoverRegistry: options?.attached === false ? undefined : hoverRegistry
    });

    return {
      registry,
      hoverRegistry,
      visibility,
      mesh
    };
  }

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
    const { hoverRegistry, visibility, mesh } = createHoverHarness({ attached: false });
    mesh.position.set(0, 0, 10);
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

    const behindCamera = createFrontCamera();
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
