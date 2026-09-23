// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { HighlightBoxSilhouette } from "#src/index.ts";

function createTarget(
  size: [number, number, number] = [1, 1, 1]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(...size));
}

function backPassOf(
  overlay: HighlightBoxSilhouette
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined {
  return overlay.children.find(
    (child): child is THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> => (
      child instanceof THREE.Mesh && child.material.depthFunc === THREE.GreaterDepth
    )
  );
}

function colorAt(
  geometry: THREE.BufferGeometry,
  index: number
): THREE.Color {
  const attribute = geometry.getAttribute("color");

  return new THREE.Color(attribute.getX(index), attribute.getY(index), attribute.getZ(index));
}

describe("constructor", () => {
  test("builds a non-empty geometry from the target's own bounding box", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget() });

    assert.ok(overlay.geometry.getAttribute("position").count > 0);
  });

  test("adds itself as a child of the target", () => {
    const target = createTarget();
    const overlay = new HighlightBoxSilhouette({ target });

    assert.strictEqual(target.children.length, 1);
    assert.strictEqual(target.children[0], overlay);
  });

  test("has no children when xray is off (no occluded pass needed)", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget() });

    assert.strictEqual(overlay.children.length, 0);
  });

  test("defaults to white, full opacity", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget() });

    assert.strictEqual(`#${overlay.color.getHexString()}`, "#ffffff");
    assert.strictEqual(overlay.material.opacity, 1);
  });

  test("carries the color as a vertex color, not the material's own color", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget(), color: "#ff0000" });

    assert.strictEqual(`#${overlay.color.getHexString()}`, "#ff0000");
    assert.strictEqual(overlay.material.vertexColors, true);
  });

  test("colors the inner border and the outer ring differently, meeting with no gap", () => {
    const overlay = new HighlightBoxSilhouette({
      target: createTarget(), color: "#ff0000", innerColor: "#00ff00"
    });

    const first = colorAt(overlay.geometry, 0);
    const last = colorAt(overlay.geometry, overlay.geometry.getAttribute("position").count - 1);
    assert.strictEqual(`#${first.getHexString()}`, "#00ff00");
    assert.strictEqual(`#${last.getHexString()}`, "#ff0000");
  });

  test("skips the inner color entirely when innerThickness is 0", () => {
    const overlay = new HighlightBoxSilhouette({
      target: createTarget(), color: "#ff0000", innerColor: "#00ff00", innerThickness: 0
    });

    const count = overlay.geometry.getAttribute("position").count;
    for (let index = 0; index < count; index++) {
      assert.strictEqual(`#${colorAt(overlay.geometry, index).getHexString()}`, "#ff0000");
    }
  });

  test("defaults thickness to 0.05 world units, pushed out past the default inner border", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget() });

    overlay.geometry.computeBoundingBox();
    const box = overlay.geometry.boundingBox as THREE.Box3;
    assert.ok(Math.abs((box.max.x - box.min.x) - 1.14) < 1e-6);
  });

  test("defaults to depth-tested with a low render order", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget() });

    assert.strictEqual(overlay.material.depthTest, true);
    assert.strictEqual(overlay.material.depthWrite, true);
    assert.strictEqual(overlay.renderOrder, 1);
  });

  test("xray keeps the front pass depth-tested and drops depth write", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget(), xray: true });

    /*
     * The visible portion still depth-tests normally; a separate dimmed
     * pass (added below the target) covers the occluded portion instead.
     */
    assert.strictEqual(overlay.material.depthTest, true);
    assert.strictEqual(overlay.material.depthWrite, false);
    assert.strictEqual(overlay.renderOrder, 999);
  });

  test("xray adds a single dimmed pass for the occluded portion", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget(), xray: true, opacity: 0.8 });

    assert.strictEqual(overlay.children.length, 1);
    const back = backPassOf(overlay);
    assert.ok(back);
    assert.strictEqual(back.material.depthTest, true);
    assert.strictEqual(back.material.opacity, 0.8);
  });

  test("dims the occluded portion further when occludedOpacity is set", () => {
    const overlay = new HighlightBoxSilhouette({
      target: createTarget(), xray: true, opacity: 0.8, occludedOpacity: 0.2
    });

    assert.strictEqual(backPassOf(overlay)?.material.opacity, 0.2);
  });

  test("skips the dimmed pass entirely when xray is off", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget(), xray: false });

    assert.strictEqual(overlay.material.depthTest, true);
    assert.strictEqual(overlay.material.depthWrite, true);
    assert.strictEqual(overlay.children.length, 0);
  });

  test("renders a peer indicator below a local one at the same xray tier", () => {
    const local = new HighlightBoxSilhouette({ target: createTarget(), xray: true });
    const peer = new HighlightBoxSilhouette({ target: createTarget(), xray: true, peer: true });

    assert.ok(peer.renderOrder < local.renderOrder);
  });

  test("renders a peer indicator below a local one off xray too", () => {
    const local = new HighlightBoxSilhouette({ target: createTarget(), xray: false });
    const peer = new HighlightBoxSilhouette({ target: createTarget(), xray: false, peer: true });

    assert.ok(peer.renderOrder < local.renderOrder);
  });

  test("honors an explicit render order over the xray default", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget(), xray: true, renderOrder: 500 });

    assert.strictEqual(overlay.renderOrder, 500);
  });
});

describe("color", () => {
  test("updates only the outer ring's vertex colors, leaving the inner border untouched", () => {
    const overlay = new HighlightBoxSilhouette({
      target: createTarget(), color: "#000000", innerColor: "#00ff00"
    });

    overlay.color = "#0000ff";

    const first = colorAt(overlay.geometry, 0);
    const last = colorAt(overlay.geometry, overlay.geometry.getAttribute("position").count - 1);
    assert.strictEqual(`#${first.getHexString()}`, "#00ff00");
    assert.strictEqual(`#${last.getHexString()}`, "#0000ff");
  });

  test("flags the color attribute for upload", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget() });
    const attribute = overlay.geometry.getAttribute("color") as THREE.BufferAttribute;
    const version = attribute.version;

    overlay.color = "#123456";

    assert.ok(attribute.version > version);
  });
});

describe("opacity", () => {
  test("updates the shared material opacity without ever leaving the transparent pass", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget() });

    overlay.opacity = 0.5;
    assert.strictEqual(overlay.material.opacity, 0.5);
    assert.strictEqual(overlay.material.transparent, true);

    overlay.opacity = 1;
    assert.strictEqual(overlay.material.opacity, 1);
    assert.strictEqual(overlay.material.transparent, true);
  });
});

describe("xray", () => {
  test("toggling xray on drops depth write, keeps depth test, and leaves render order untouched", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget() });
    const before = overlay.renderOrder;
    overlay.xray = true;

    assert.strictEqual(overlay.material.depthTest, true);
    assert.strictEqual(overlay.material.depthWrite, false);
    assert.strictEqual(overlay.renderOrder, before);
  });

  test("toggling xray back off removes the occluded pass", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget(), xray: true });

    overlay.xray = false;

    assert.strictEqual(overlay.material.depthWrite, true);
    assert.strictEqual(overlay.children.length, 0);
  });
});

describe("update", () => {
  test("keeps only the 4 edges and their corner joints for a single camera-facing side", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget(), innerThickness: 0 });

    overlay.update(new THREE.Vector3(100, 0, 0));

    // 4 bars + 4 joints, each an unfiltered box (24 verts, 36 indices).
    assert.strictEqual(overlay.geometry.getAttribute("position").count, 192);
    /*
     * Each of the 8 boxes drops exactly the 2 faces coincident with the
     * piece it touches, leaving 4 of 6 faces (24 of 36 indices). Left
     * unfiltered this would be 8 * 36 = 288; this confirms the drop
     * actually happened rather than just leaving the geometry untouched.
     */
    assert.strictEqual(overlay.geometry.getIndex()?.count, 192);
  });

  test("excludes interior creases, keeping 6 edges and their joints for a corner-on view", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget(), innerThickness: 0 });

    overlay.update(new THREE.Vector3(100, 100, 100));

    // 6 bars + 6 joints, each an unfiltered box (24 verts, 36 indices).
    assert.strictEqual(overlay.geometry.getAttribute("position").count, 288);
    // Left unfiltered this would be 12 * 36 = 432; see the test above.
    assert.strictEqual(overlay.geometry.getIndex()?.count, 288);
  });

  test("skips rewriting the geometry when the camera stays on the same side", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget() });
    overlay.update(new THREE.Vector3(100, 0, 0));
    const { geometry } = overlay;

    overlay.update(new THREE.Vector3(120, 0, 0));

    assert.strictEqual(overlay.geometry, geometry);
  });

  test("rewrites the geometry once the camera crosses to another side", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget() });
    overlay.update(new THREE.Vector3(100, 0, 0));
    const { geometry } = overlay;

    overlay.update(new THREE.Vector3(-100, 0, 0));

    assert.notStrictEqual(overlay.geometry, geometry);
  });

  test("keeps the occluded pass sharing the rebuilt geometry", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget(), xray: true });

    overlay.update(new THREE.Vector3(100, 0, 0));

    assert.strictEqual(backPassOf(overlay)?.geometry, overlay.geometry);
  });

  test("recolors the rebuilt geometry's outer ring after a color change", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget(), color: "#ff0000" });
    overlay.color = "#0000ff";

    overlay.update(new THREE.Vector3(100, 0, 0));

    const last = colorAt(overlay.geometry, overlay.geometry.getAttribute("position").count - 1);
    assert.strictEqual(`#${last.getHexString()}`, "#0000ff");
  });

  test("never grows past halfExtents + linewidth, however many edges are kept", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget() });

    overlay.update(new THREE.Vector3(100, 100, 100));

    const box = new THREE.Box3().setFromBufferAttribute(
      overlay.geometry.getAttribute("position") as THREE.BufferAttribute
    );
    assert.ok(Math.abs((box.max.x - box.min.x) - 1.14) < 1e-6);
  });
});

describe("dispose", () => {
  test("removes itself from the target and disposes geometry/material", () => {
    const target = createTarget();
    const overlay = new HighlightBoxSilhouette({ target });

    let geometryDisposed = false;
    let materialDisposed = false;
    overlay.geometry.addEventListener("dispose", () => {
      geometryDisposed = true;
    });
    overlay.material.addEventListener("dispose", () => {
      materialDisposed = true;
    });

    overlay.dispose();

    assert.strictEqual(target.children.length, 0);
    assert.ok(geometryDisposed);
    assert.ok(materialDisposed);
  });

  test("also disposes the occluded pass's own material", () => {
    const overlay = new HighlightBoxSilhouette({ target: createTarget(), xray: true });
    const back = backPassOf(overlay);
    let backMaterialDisposed = false;
    back?.material.addEventListener("dispose", () => {
      backMaterialDisposed = true;
    });

    overlay.dispose();

    assert.ok(backMaterialDisposed);
  });
});
