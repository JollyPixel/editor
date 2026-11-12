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

// CONSTANTS
const kCamera = new THREE.Vector3(10, 10, 10);

function createMesh(): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 8));
}

function findSilhouette(
  mesh: THREE.Mesh
): HighlightSilhouette | undefined {
  return mesh.children.find(
    (child): child is HighlightSilhouette => child instanceof HighlightSilhouette
  );
}

describe("HighlightGroupSilhouette", () => {
  test("outlines the visible meshes of a silhouetted group as they come and go", () => {
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
    assert.strictEqual(findSilhouette(hidden), undefined);
    assert.strictEqual(instanced.children.length, 0);

    const late = createMesh();
    shown.add(late);
    hidden.visible = true;
    overlay.update(kCamera);
    assert.ok(findSilhouette(late));
    assert.ok(findSilhouette(hidden));

    shown.remove(late);
    overlay.update(kCamera);
    assert.strictEqual(findSilhouette(late), undefined);

    overlay.dispose();
    assert.strictEqual(findSilhouette(shown), undefined);
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
