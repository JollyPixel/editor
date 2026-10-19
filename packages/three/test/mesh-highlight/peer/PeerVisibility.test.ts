// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { PeerHighlights } from "#src/index.ts";
import type { MeshHighlightState } from "#src/mesh-highlight/MeshHighlightState.ts";
import { PeerVisibility } from "#src/mesh-highlight/peer/PeerVisibility.ts";
import {
  createFrontCamera,
  createPeerScene
} from "./helpers.ts";

function createHarness(
  options?: { maxDistance?: number; }
): {
  state: MeshHighlightState;
  peers: PeerHighlights;
  camera: THREE.PerspectiveCamera;
  visibility: PeerVisibility;
  mesh: THREE.Mesh;
} {
  const { state, peers, mesh } = createPeerScene();
  const camera = createFrontCamera();

  const visibility = new PeerVisibility({
    peers,
    state,
    camera,
    maxDistance: options?.maxDistance
  });

  return {
    state,
    peers,
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
    const { peers, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, -10);
    peers.select("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), true);
  });

  test("false for a peer-selected object behind the camera", () => {
    const { peers, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, 10);
    peers.select("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), false);
  });

  test("false for a peer-selected object outside the frustum's field of view", () => {
    const { peers, visibility, mesh } = createHarness();
    mesh.position.set(50, 0, -10);
    peers.select("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), false);
  });

  test("not gated by distance when maxDistance is left at its Infinity default", () => {
    const { peers, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, -900);
    peers.select("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), true);
  });

  test("false for a peer-selected object beyond maxDistance, even inside the frustum", () => {
    const { peers, visibility, mesh } = createHarness({ maxDistance: 20 });
    mesh.position.set(0, 0, -50);
    peers.select("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), false);
  });

  test("true for a peer-selected object within maxDistance", () => {
    const { peers, visibility, mesh } = createHarness({ maxDistance: 20 });
    mesh.position.set(0, 0, -10);
    peers.select("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), true);
  });
});

describe("peer hovers", () => {
  test("false for a peer-hovered-only object behind the camera", () => {
    const { peers, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, 10);
    peers.hover("peer-a", "mesh-1");

    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), false);
  });
});

describe("camera and maxDistance", () => {
  test("maxDistance changes the cutoff applied on the next update()", () => {
    const { peers, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, -50);
    peers.select("peer-a", "mesh-1");
    visibility.update();
    assert.strictEqual(visibility.isVisible("mesh-1"), true);

    visibility.maxDistance = 20;
    visibility.update();

    assert.strictEqual(visibility.isVisible("mesh-1"), false);
  });

  test("camera changes which camera update() tests against", () => {
    const { peers, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, -10);
    peers.select("peer-a", "mesh-1");
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
    const { peers, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, -10);
    peers.select("peer-a", "mesh-1");
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
    const { peers, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, -10);
    peers.select("peer-a", "mesh-1");
    visibility.update();

    let dispatched = false;
    visibility.addEventListener("visibilityChange", () => {
      dispatched = true;
    });
    visibility.update();

    assert.strictEqual(dispatched, false);
  });

  test("does not dispatch merely because a tracked id is no longer peer-selected", () => {
    const { peers, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, -10);
    peers.select("peer-a", "mesh-1");
    visibility.update();

    let dispatched = false;
    visibility.addEventListener("visibilityChange", () => {
      dispatched = true;
    });
    peers.select("peer-a", null);
    visibility.update();

    assert.strictEqual(dispatched, false);
  });
});

describe("dispose", () => {
  test("clears tracked state - isVisible falls back to its default true", () => {
    const { peers, visibility, mesh } = createHarness();
    mesh.position.set(0, 0, 10);
    peers.select("peer-a", "mesh-1");
    visibility.update();
    assert.strictEqual(visibility.isVisible("mesh-1"), false);

    visibility.dispose();

    assert.strictEqual(visibility.isVisible("mesh-1"), true);
  });
});
