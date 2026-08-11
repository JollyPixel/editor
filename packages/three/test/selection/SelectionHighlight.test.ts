// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";

// Import Internal Dependencies
import { SelectionHighlight } from "#src/index.ts";

function createTarget(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
}

describe("constructor", () => {
  test("builds its own hull geometry rather than sharing the target's", () => {
    const target = createTarget();
    const highlight = new SelectionHighlight({ target });

    assert.notStrictEqual(highlight.geometry, target.geometry);
  });

  test("renders back faces only", () => {
    const highlight = new SelectionHighlight({ target: createTarget() });

    assert.strictEqual(highlight.material.side, THREE.BackSide);
  });

  test("adds itself as a child of the target", () => {
    const target = createTarget();
    const highlight = new SelectionHighlight({ target });

    assert.strictEqual(target.children.length, 1);
    assert.strictEqual(target.children[0], highlight);
  });

  test("defaults to white, full opacity, non-transparent", () => {
    const highlight = new SelectionHighlight({ target: createTarget() });

    assert.strictEqual(`#${highlight.material.color.getHexString()}`, "#ffffff");
    assert.strictEqual(highlight.material.opacity, 1);
    assert.strictEqual(highlight.material.transparent, false);
  });

  test("opacity < 1 marks the material transparent", () => {
    const highlight = new SelectionHighlight({ target: createTarget(), opacity: 0.4 });

    assert.strictEqual(highlight.material.opacity, 0.4);
    assert.strictEqual(highlight.material.transparent, true);
  });

  test("applies the given color", () => {
    const highlight = new SelectionHighlight({ target: createTarget(), color: "#ff0000" });

    assert.strictEqual(`#${highlight.material.color.getHexString()}`, "#ff0000");
  });

  test("defaults to depth-tested with a low render order", () => {
    const highlight = new SelectionHighlight({ target: createTarget() });

    assert.strictEqual(highlight.material.depthTest, true);
    assert.strictEqual(highlight.material.depthWrite, true);
    assert.strictEqual(highlight.renderOrder, 1);
  });

  test("xray disables depth test/write and raises the render order above default objects", () => {
    const highlight = new SelectionHighlight({ target: createTarget(), xray: true });

    assert.strictEqual(highlight.material.depthTest, false);
    assert.strictEqual(highlight.material.depthWrite, false);
    assert.ok(highlight.renderOrder > 1);
  });

  test("xray marks the material transparent even at full opacity, for the Fresnel fade to blend correctly", () => {
    const highlight = new SelectionHighlight({ target: createTarget(), xray: true });

    assert.strictEqual(highlight.material.opacity, 1);
    assert.strictEqual(highlight.material.transparent, true);
  });

  test("uses a MeshBasicNodeMaterial with an opacityNode wired up for the xray Fresnel fade", () => {
    const highlight = new SelectionHighlight({ target: createTarget() });

    assert.ok(highlight.material instanceof MeshBasicNodeMaterial);
    assert.notStrictEqual(highlight.material.opacityNode, null);
  });

  test("applies a custom thickness to the hull extrusion", () => {
    const target = createTarget();
    const defaultHighlight = new SelectionHighlight({ target: createTarget() });
    const thickHighlight = new SelectionHighlight({ target, thickness: 0.1 });

    const defaultPosition = defaultHighlight.geometry.getAttribute("position");
    const thickPosition = thickHighlight.geometry.getAttribute("position");
    const targetPosition = target.geometry.getAttribute("position");

    const defaultDelta = new THREE.Vector3().fromBufferAttribute(defaultPosition, 0)
      .sub(new THREE.Vector3().fromBufferAttribute(targetPosition, 0)).length();
    const thickDelta = new THREE.Vector3().fromBufferAttribute(thickPosition, 0)
      .sub(new THREE.Vector3().fromBufferAttribute(targetPosition, 0)).length();

    assert.ok(thickDelta > defaultDelta);
  });
});

describe("hull extrusion", () => {
  test("pushes an isolated vertex outward along its own normal, scaled by the target's bounding-sphere radius", () => {
    // Three distinct, non-coincident vertices so position-averaging (see the
    // "hard-edged" test below) is a no-op here - isolates the base extrusion
    // math from that behavior.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(
      new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), 3
    ));
    geometry.setAttribute("normal", new THREE.BufferAttribute(
      new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), 3
    ));
    const target = new THREE.Mesh(geometry);
    const highlight = new SelectionHighlight({ target });

    geometry.computeBoundingSphere();
    const expectedBias = geometry.boundingSphere!.radius * 0.03;

    const hullPosition = highlight.geometry.getAttribute("position");
    const original = new THREE.Vector3(1, 0, 0);
    const extruded = new THREE.Vector3().fromBufferAttribute(hullPosition, 0);
    const delta = extruded.clone().sub(original);

    assert.strictEqual(hullPosition.count, 3);
    assert.ok(Math.abs(delta.length() - expectedBias) < 1e-6);
    assert.ok(delta.clone().normalize().distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-6);
  });

  test("keeps a hard-edged mesh's shared corners connected instead of pulling them apart", () => {
    const target = createTarget();
    const highlight = new SelectionHighlight({ target });

    const targetPosition = target.geometry.getAttribute("position");
    const hullPosition = highlight.geometry.getAttribute("position");

    const indicesByPosition = new Map<string, number[]>();
    const vertex = new THREE.Vector3();
    for (let i = 0; i < targetPosition.count; i++) {
      vertex.fromBufferAttribute(targetPosition, i);
      const key = `${vertex.x.toFixed(5)},${vertex.y.toFixed(5)},${vertex.z.toFixed(5)}`;
      const indices = indicesByPosition.get(key) ?? [];
      indices.push(i);
      indicesByPosition.set(key, indices);
    }

    const sharedCorner = [...indicesByPosition.values()].find((indices) => indices.length > 1);
    assert.ok(sharedCorner, "BoxGeometry is expected to duplicate a vertex per adjacent face");

    const [first, ...rest] = sharedCorner as number[];
    const expected = new THREE.Vector3().fromBufferAttribute(hullPosition, first);
    for (const i of rest) {
      const actual = new THREE.Vector3().fromBufferAttribute(hullPosition, i);
      assert.ok(actual.distanceTo(expected) < 1e-5);
    }
  });

  test("clones the target's index buffer rather than sharing it", () => {
    const target = createTarget();
    const highlight = new SelectionHighlight({ target });

    // Identity must differ: a renderer frees a disposed geometry's index
    // buffer by attribute identity, so sharing the target's own index
    // attribute here would let `highlight.dispose()` take down the target's
    // GPU index buffer out from under it (see SelectionHighlight's Notes).
    assert.notStrictEqual(highlight.geometry.index, target.geometry.index);
    assert.deepStrictEqual(highlight.geometry.index?.array, target.geometry.index?.array);
  });
});

describe("setColor", () => {
  test("updates the material color", () => {
    const highlight = new SelectionHighlight({ target: createTarget(), color: "#000000" });
    highlight.setColor("#00ff00");

    assert.strictEqual(`#${highlight.material.color.getHexString()}`, "#00ff00");
  });
});

describe("setOpacity", () => {
  test("updates opacity and toggles transparent accordingly", () => {
    const highlight = new SelectionHighlight({ target: createTarget() });

    highlight.setOpacity(0.5);
    assert.strictEqual(highlight.material.opacity, 0.5);
    assert.strictEqual(highlight.material.transparent, true);

    highlight.setOpacity(1);
    assert.strictEqual(highlight.material.opacity, 1);
    assert.strictEqual(highlight.material.transparent, false);
  });

  test("keeps transparent when opacity is set back to 1 while xray is on", () => {
    const highlight = new SelectionHighlight({ target: createTarget(), xray: true, opacity: 0.5 });
    highlight.setOpacity(1);

    assert.strictEqual(highlight.material.opacity, 1);
    assert.strictEqual(highlight.material.transparent, true);
  });
});

describe("setThickness", () => {
  test("rebuilds the hull geometry at the new thickness, disposing the previous one", () => {
    const target = createTarget();
    const highlight = new SelectionHighlight({ target });
    const previousGeometry = highlight.geometry;

    let previousGeometryDisposed = false;
    previousGeometry.addEventListener("dispose", () => {
      previousGeometryDisposed = true;
    });

    highlight.setThickness(0.2);

    assert.notStrictEqual(highlight.geometry, previousGeometry);
    assert.ok(previousGeometryDisposed);

    const targetPosition = target.geometry.getAttribute("position");
    const hullPosition = highlight.geometry.getAttribute("position");
    const delta = new THREE.Vector3().fromBufferAttribute(hullPosition, 0)
      .sub(new THREE.Vector3().fromBufferAttribute(targetPosition, 0)).length();

    target.geometry.computeBoundingSphere();
    const expectedBias = target.geometry.boundingSphere!.radius * 0.2;
    assert.ok(Math.abs(delta - expectedBias) < 1e-6);
  });
});

describe("setXray", () => {
  test("toggling xray on disables depth test/write and raises render order", () => {
    const highlight = new SelectionHighlight({ target: createTarget() });
    highlight.setXray(true);

    assert.strictEqual(highlight.material.depthTest, false);
    assert.strictEqual(highlight.material.depthWrite, false);
    assert.ok(highlight.renderOrder > 1);
  });

  test("toggling xray off restores depth test/write and the default render order", () => {
    const highlight = new SelectionHighlight({ target: createTarget(), xray: true });
    highlight.setXray(false);

    assert.strictEqual(highlight.material.depthTest, true);
    assert.strictEqual(highlight.material.depthWrite, true);
    assert.strictEqual(highlight.renderOrder, 1);
  });

  test("toggling xray on marks the material transparent even at full opacity", () => {
    const highlight = new SelectionHighlight({ target: createTarget() });
    highlight.setXray(true);

    assert.strictEqual(highlight.material.transparent, true);
  });

  test("toggling xray off drops transparent again when opacity is still 1", () => {
    const highlight = new SelectionHighlight({ target: createTarget(), xray: true });
    highlight.setXray(false);

    assert.strictEqual(highlight.material.transparent, false);
  });

  test("toggling xray off keeps transparent when opacity is below 1", () => {
    const highlight = new SelectionHighlight({ target: createTarget(), opacity: 0.5, xray: true });
    highlight.setXray(false);

    assert.strictEqual(highlight.material.transparent, true);
  });
});

describe("dispose", () => {
  test("removes itself from the target and disposes its own geometry/material, not the target's", () => {
    const target = createTarget();
    const highlight = new SelectionHighlight({ target });

    let targetGeometryDisposed = false;
    let hullGeometryDisposed = false;
    let materialDisposed = false;
    target.geometry.addEventListener("dispose", () => {
      targetGeometryDisposed = true;
    });
    highlight.geometry.addEventListener("dispose", () => {
      hullGeometryDisposed = true;
    });
    highlight.material.addEventListener("dispose", () => {
      materialDisposed = true;
    });

    highlight.dispose();

    assert.strictEqual(target.children.length, 0);
    assert.ok(hullGeometryDisposed);
    assert.ok(materialDisposed);
    assert.strictEqual(targetGeometryDisposed, false, "must not dispose the target's own geometry");
  });
});
