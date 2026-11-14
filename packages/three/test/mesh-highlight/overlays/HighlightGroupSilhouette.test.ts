// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  HighlightBoundingBox,
  HighlightGroupSilhouette,
  HighlightSilhouette
} from "#src/index.ts";
import {
  createDefaultHighlightOverlayRegistry
} from "#src/mesh-highlight/overlays/builtinHighlightOverlayFactories.ts";
import { createBoxMesh } from "../helpers.ts";

// CONSTANTS
const kCamera = new THREE.Vector3(10, 10, 10);

function createMesh(): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 8));
}

function createRod(
  angle: number
): THREE.Mesh {
  const rod = createBoxMesh([0.2, 4, 0.2]);
  rod.rotation.z = angle;

  return rod;
}

function findSilhouettes(
  object: THREE.Object3D
): HighlightSilhouette[] {
  return object.children.filter(
    (child): child is HighlightSilhouette => child instanceof HighlightSilhouette
  );
}

function findSilhouette(
  object: THREE.Object3D
): HighlightSilhouette | undefined {
  return findSilhouettes(object)[0];
}

function outlineWidth(
  silhouette: HighlightSilhouette
): number {
  silhouette.geometry.computeBoundingBox();
  const bounds = silhouette.geometry.boundingBox as THREE.Box3;

  return bounds.max.x - bounds.min.x;
}

describe("HighlightGroupSilhouette", () => {
  test("outlines the only visible mesh of a group, skipping hidden and instanced ones", () => {
    const group = new THREE.Group();
    const shown = createMesh();
    const hidden = createMesh();
    hidden.visible = false;
    const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(), undefined, 2);
    group.add(shown, hidden, instanced);

    const overlay = createDefaultHighlightOverlayRegistry().create(group, {
      technique: "silhouette",
      color: "#ffffff",
      opacity: 1
    });

    assert.ok(overlay instanceof HighlightGroupSilhouette);
    assert.ok(findSilhouette(shown));
    assert.strictEqual(findSilhouette(group), undefined);
    assert.strictEqual(instanced.children.length, 0);

    overlay.dispose();
    assert.strictEqual(findSilhouette(shown), undefined);
  });

  test("draws one outline around crossing meshes instead of one per mesh", () => {
    const group = new THREE.Group();
    const rods = [0, Math.PI / 4, Math.PI / 2, -Math.PI / 4].map(createRod);
    group.add(...rods);

    const overlay = new HighlightGroupSilhouette({ target: group });
    overlay.update(kCamera);

    assert.strictEqual(findSilhouettes(group).length, 1);
    assert.ok(rods.every((rod) => findSilhouette(rod) === undefined));

    overlay.dispose();
    assert.strictEqual(findSilhouette(group), undefined);
  });

  test("grows the shared outline when a mesh moves out", () => {
    const group = new THREE.Group();
    const moving = createRod(0);
    group.add(createRod(Math.PI / 2), moving);
    const overlay = new HighlightGroupSilhouette({ target: group });
    overlay.update(kCamera);
    const before = outlineWidth(findSilhouette(group)!);

    moving.position.x = 5;
    overlay.update(kCamera);

    assert.ok(outlineWidth(findSilhouette(group)!) > before + 3);
  });

  test("goes back to a mesh outline when a single mesh stays visible", () => {
    const group = new THREE.Group();
    const kept = createRod(0);
    const hidden = createRod(Math.PI / 2);
    group.add(kept, hidden);
    const overlay = new HighlightGroupSilhouette({ target: group });

    hidden.visible = false;
    overlay.update(kCamera);

    assert.strictEqual(findSilhouette(group), undefined);
    assert.ok(findSilhouette(kept));
    assert.strictEqual(findSilhouette(hidden), undefined);
  });

  test("outlines each mesh of a flat group, which has no enclosing outline", () => {
    const group = new THREE.Group();
    const planes = [0, 2].map((x) => {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
      plane.position.x = x;

      return plane;
    });
    group.add(...planes);

    const overlay = new HighlightGroupSilhouette({ target: group });
    overlay.update(kCamera);

    assert.strictEqual(findSilhouette(group), undefined);
    assert.ok(planes.every((plane) => findSilhouette(plane)));
  });

  test("leaves out the meshes of other highlight overlays on the same target", () => {
    const group = new THREE.Group();
    const mesh = createMesh();
    group.add(mesh);
    const bounds = new HighlightBoundingBox({
      target: group,
      fillOpacity: 0.2
    });
    const fill = bounds.children.find(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh
    );
    assert.ok(fill);

    new HighlightGroupSilhouette({ target: group });

    assert.ok(findSilhouette(mesh));
    assert.strictEqual(findSilhouette(fill), undefined);
  });
});
