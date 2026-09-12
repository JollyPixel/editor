// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { BrushMesh } from "../../../../src/features/painting/rendering/BrushMesh.ts";
import { DEFAULT_BRUSH_STYLE } from "../../../../src/features/painting/model/BrushStyle.ts";
import type { BrushCursor } from "../../../../src/features/painting/model/brushCursor.ts";

function cursorOf(
  patch: Partial<BrushCursor> = {}
): BrushCursor {
  return {
    position: { x: 0, y: 0, z: 0 },
    size: 1,
    axis: "xz",
    pattern: "square",
    ...patch
  };
}

function vertexCountOf(
  mesh: BrushMesh
): number {
  return fillOf(mesh).geometry.getAttribute("position").count;
}

function fillOf(
  mesh: BrushMesh
): THREE.Mesh {
  return mesh.children[0] as THREE.Mesh;
}

interface LineMaterialLike {
  linewidth: number;
  dashed: boolean;
  dashSize: number;
  gapSize: number;
}

function borderOf(
  mesh: BrushMesh
): THREE.Object3D {
  return mesh.children[1];
}

function borderMaterialOf(
  mesh: BrushMesh
): LineMaterialLike {
  const border = mesh.children[1] as THREE.Mesh;

  return border.material as THREE.Material & LineMaterialLike;
}

describe("BrushMesh", () => {
  test("draws one volume and one outline, whatever the size", () => {
    const mesh = new BrushMesh();

    mesh.draw(cursorOf({ size: 1 }));
    mesh.draw(cursorOf({ size: 8 }));

    assert.strictEqual(mesh.children.length, 2);
  });

  test("outlines the outer faces of the footprint only", () => {
    const mesh = new BrushMesh();

    mesh.draw(cursorOf({
      position: { x: 4, y: 2, z: 6 },
      size: 3
    }));

    const box = fillOf(mesh).geometry;
    box.computeBoundingBox();
    assert.strictEqual(vertexCountOf(mesh), (9 + 9 + (4 * 3)) * 6);
    assert.deepStrictEqual(
      box.boundingBox!.max.toArray().map((value) => Number(value.toFixed(3))),
      [1.51, 0.51, 1.51]
    );
    // The 3x3 footprint spans x 3..6 and z 5..8, centered on its middle cell.
    assert.deepStrictEqual(
      [mesh.position.x, mesh.position.y, mesh.position.z],
      [4.5, 2.5, 6.5]
    );
  });

  test("follows the cells of a circle", () => {
    const mesh = new BrushMesh();

    mesh.draw(cursorOf({ size: 4 }));
    const square = vertexCountOf(mesh);
    mesh.draw(cursorOf({
      size: 4,
      pattern: "circle"
    }));

    assert.ok(vertexCountOf(mesh) !== square);
  });

  test("keeps its geometry while only the position moves", () => {
    const mesh = new BrushMesh();

    mesh.draw(cursorOf({ size: 2, axis: "xy" }));
    const geometry = fillOf(mesh).geometry;
    mesh.draw(cursorOf({
      size: 2,
      axis: "xy",
      position: { x: 9, y: 1, z: 3 }
    }));

    assert.strictEqual(fillOf(mesh).geometry, geometry);
    assert.deepStrictEqual(
      [mesh.position.x, mesh.position.y, mesh.position.z],
      [9, 2, 3.5]
    );
  });

  test("stays hidden until a footprint is drawn", () => {
    const mesh = new BrushMesh();

    assert.strictEqual(fillOf(mesh).visible, false);
    assert.strictEqual(borderOf(mesh).visible, false);

    mesh.draw(cursorOf({ size: 1 }));

    assert.strictEqual(fillOf(mesh).visible, true);
    assert.strictEqual(borderOf(mesh).visible, true);
  });

  test("hides everything once the footprint is cleared", () => {
    const mesh = new BrushMesh();

    mesh.draw(cursorOf({ size: 1 }));
    mesh.clearFootprint();

    assert.ok(
      mesh.children.every((child) => child.visible === false)
    );
  });

  test("hide wins over a drawn footprint", () => {
    const mesh = new BrushMesh();

    mesh.draw(cursorOf({ size: 1 }));
    mesh.hide();

    assert.ok(
      mesh.children.every((child) => child.visible === false)
    );

    mesh.show();

    assert.ok(
      mesh.children.every((child) => child.visible === true)
    );
  });
});

describe("BrushMesh / style", () => {
  test("applies the opacity to the volume", () => {
    const mesh = new BrushMesh();

    mesh.style = {
      ...DEFAULT_BRUSH_STYLE,
      opacity: 0.5
    };

    const material = fillOf(mesh).material as THREE.MeshBasicMaterial;
    assert.strictEqual(material.opacity, 0.5);
  });

  test("a fully transparent volume leaves the outline alone", () => {
    const mesh = new BrushMesh();

    mesh.draw(cursorOf({ size: 1 }));
    mesh.style = {
      ...DEFAULT_BRUSH_STYLE,
      opacity: 0
    };

    assert.strictEqual(fillOf(mesh).visible, false);
    assert.strictEqual(borderOf(mesh).visible, true);
  });

  test("an edgeless brush hides its outline", () => {
    const mesh = new BrushMesh();

    mesh.draw(cursorOf({ size: 1 }));
    mesh.style = {
      ...DEFAULT_BRUSH_STYLE,
      edgeWidth: 0
    };

    assert.strictEqual(borderOf(mesh).visible, false);
  });

  test("applies the edge width and dash pattern", () => {
    const mesh = new BrushMesh();

    mesh.style = {
      ...DEFAULT_BRUSH_STYLE,
      edgeWidth: 4,
      edgeStyle: "dashed",
      dashSize: 0.4,
      gapSize: 0.2
    };

    const material = borderMaterialOf(mesh);
    assert.strictEqual(material.linewidth, 4);
    assert.strictEqual(material.dashed, true);
    assert.strictEqual(material.dashSize, 0.4);
    assert.strictEqual(material.gapSize, 0.2);
  });

  test("drops a style member that is out of bounds", () => {
    const mesh = new BrushMesh();

    mesh.style = {
      ...DEFAULT_BRUSH_STYLE,
      opacity: 4
    };

    assert.strictEqual(mesh.style.opacity, 1);
  });
});
