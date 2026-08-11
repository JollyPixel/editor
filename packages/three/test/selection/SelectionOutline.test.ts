// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { SelectionOutline } from "#src/index.ts";

function createTarget(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
}

describe("constructor", () => {
  test("builds an edges geometry matching the target's", () => {
    const target = createTarget();
    const outline = new SelectionOutline({ target });
    const expected = new THREE.EdgesGeometry(target.geometry);

    assert.strictEqual(
      outline.geometry.getAttribute("position").count,
      expected.getAttribute("position").count
    );
  });

  test("adds itself as a child of the target", () => {
    const target = createTarget();
    const outline = new SelectionOutline({ target });

    assert.strictEqual(target.children.length, 1);
    assert.strictEqual(target.children[0], outline);
  });

  test("defaults to white, full opacity, non-transparent", () => {
    const outline = new SelectionOutline({ target: createTarget() });

    assert.strictEqual(`#${outline.material.color.getHexString()}`, "#ffffff");
    assert.strictEqual(outline.material.opacity, 1);
    assert.strictEqual(outline.material.transparent, false);
  });

  test("opacity < 1 marks the material transparent", () => {
    const outline = new SelectionOutline({ target: createTarget(), opacity: 0.4 });

    assert.strictEqual(outline.material.opacity, 0.4);
    assert.strictEqual(outline.material.transparent, true);
  });

  test("applies the given color", () => {
    const outline = new SelectionOutline({ target: createTarget(), color: "#ff0000" });

    assert.strictEqual(`#${outline.material.color.getHexString()}`, "#ff0000");
  });
});

describe("setColor", () => {
  test("updates the material color", () => {
    const outline = new SelectionOutline({ target: createTarget(), color: "#000000" });
    outline.setColor("#00ff00");

    assert.strictEqual(`#${outline.material.color.getHexString()}`, "#00ff00");
  });
});

describe("setOpacity", () => {
  test("updates opacity and toggles transparent accordingly", () => {
    const outline = new SelectionOutline({ target: createTarget() });

    outline.setOpacity(0.5);
    assert.strictEqual(outline.material.opacity, 0.5);
    assert.strictEqual(outline.material.transparent, true);

    outline.setOpacity(1);
    assert.strictEqual(outline.material.opacity, 1);
    assert.strictEqual(outline.material.transparent, false);
  });
});

describe("dispose", () => {
  test("removes itself from the target and disposes geometry/material", () => {
    const target = createTarget();
    const outline = new SelectionOutline({ target });

    let geometryDisposed = false;
    let materialDisposed = false;
    outline.geometry.addEventListener("dispose", () => {
      geometryDisposed = true;
    });
    outline.material.addEventListener("dispose", () => {
      materialDisposed = true;
    });

    outline.dispose();

    assert.strictEqual(target.children.length, 0);
    assert.ok(geometryDisposed);
    assert.ok(materialDisposed);
  });
});
