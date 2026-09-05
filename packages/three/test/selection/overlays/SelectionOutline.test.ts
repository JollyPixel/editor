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

  test("defaults linewidth to 1", () => {
    const outline = new SelectionOutline({ target: createTarget() });

    assert.strictEqual(outline.material.linewidth, 1);
  });

  test("applies the given linewidth", () => {
    const outline = new SelectionOutline({ target: createTarget(), linewidth: 3 });

    assert.strictEqual(outline.material.linewidth, 3);
  });

  test("defaults to depth-tested with a low render order", () => {
    const outline = new SelectionOutline({ target: createTarget() });

    assert.strictEqual(outline.material.depthTest, true);
    assert.strictEqual(outline.material.depthWrite, true);
    assert.strictEqual(outline.renderOrder, 1);
  });

  test("xray disables depth test/write and raises the render order above default objects", () => {
    const outline = new SelectionOutline({ target: createTarget(), xray: true });

    assert.strictEqual(outline.material.depthTest, false);
    assert.strictEqual(outline.material.depthWrite, false);
    assert.ok(outline.renderOrder > 1);
  });
});

describe("dashed", () => {
  test("defaults to a solid LineBasicMaterial, not LineDashedMaterial", () => {
    const outline = new SelectionOutline({ target: createTarget() });

    assert.ok(!(outline.material instanceof THREE.LineDashedMaterial));
  });

  test("builds a LineDashedMaterial with a positive dash/gap size", () => {
    const outline = new SelectionOutline({ target: createTarget(), dashed: true });

    assert.ok(outline.material instanceof THREE.LineDashedMaterial);
    assert.ok((outline.material as THREE.LineDashedMaterial).dashSize > 0);
    assert.ok((outline.material as THREE.LineDashedMaterial).gapSize > 0);
  });

  test("computes line distances so the dash pattern actually renders", () => {
    const outline = new SelectionOutline({ target: createTarget(), dashed: true });

    assert.ok(outline.geometry.getAttribute("lineDistance"));
  });

  test("still applies color/opacity/linewidth/xray - LineDashedMaterial is a LineBasicMaterial subclass", () => {
    const outline = new SelectionOutline({
      target: createTarget(), dashed: true, color: "#ff0000", opacity: 0.5, linewidth: 3, xray: true
    });

    assert.strictEqual(`#${outline.material.color.getHexString()}`, "#ff0000");
    assert.strictEqual(outline.material.opacity, 0.5);
    assert.strictEqual(outline.material.linewidth, 3);
    assert.strictEqual(outline.material.depthTest, false);
  });
});

describe("color", () => {
  test("updates the material color", () => {
    const outline = new SelectionOutline({ target: createTarget(), color: "#000000" });
    outline.color = "#00ff00";

    assert.strictEqual(`#${outline.material.color.getHexString()}`, "#00ff00");
  });
});

describe("opacity", () => {
  test("updates opacity and toggles transparent accordingly", () => {
    const outline = new SelectionOutline({ target: createTarget() });

    outline.opacity = 0.5;
    assert.strictEqual(outline.material.opacity, 0.5);
    assert.strictEqual(outline.material.transparent, true);

    outline.opacity = 1;
    assert.strictEqual(outline.material.opacity, 1);
    assert.strictEqual(outline.material.transparent, false);
  });
});

describe("linewidth", () => {
  test("updates the material linewidth", () => {
    const outline = new SelectionOutline({ target: createTarget() });
    outline.linewidth = 4;

    assert.strictEqual(outline.material.linewidth, 4);
  });
});

describe("xray", () => {
  test("toggling xray on disables depth test/write and raises render order", () => {
    const outline = new SelectionOutline({ target: createTarget() });
    outline.xray = true;

    assert.strictEqual(outline.material.depthTest, false);
    assert.strictEqual(outline.material.depthWrite, false);
    assert.ok(outline.renderOrder > 1);
  });

  test("toggling xray off restores depth test/write and the default render order", () => {
    const outline = new SelectionOutline({ target: createTarget(), xray: true });
    outline.xray = false;

    assert.strictEqual(outline.material.depthTest, true);
    assert.strictEqual(outline.material.depthWrite, true);
    assert.strictEqual(outline.renderOrder, 1);
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
