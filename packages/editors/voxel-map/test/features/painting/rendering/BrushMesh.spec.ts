// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";

// Import Internal Dependencies
import { BrushMesh } from "../../../../src/features/painting/rendering/BrushMesh.ts";
import {
  BrushFootprint,
  type BrushFootprintOptions
} from "../../../../src/features/painting/model/BrushFootprint.ts";
import { CellFace } from "../../../../src/features/painting/model/CellFace.ts";

// CONSTANTS
const kFaceMargin = 0.015;
const kEdgeWidth = 2;
const kCursor: BrushFootprintOptions = {
  position: {
    x: 0,
    y: 0,
    z: 0
  },
  size: 2,
  pattern: "square"
};

function edgeLinesOf(
  mesh: BrushMesh
): LineSegments2[] {
  return mesh.children
    .filter((child) => child instanceof LineSegments2)
    .sort((a, b) => a.renderOrder - b.renderOrder);
}

function drawnMesh(): BrushMesh {
  const mesh = new BrushMesh();
  mesh.draw(new BrushFootprint(kCursor));

  return mesh;
}

function renderFrom(
  mesh: BrushMesh,
  eye: THREE.Vector3Tuple
): void {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(...eye);
  camera.updateMatrixWorld();
  mesh.updateMatrixWorld();

  const [first] = edgeLinesOf(mesh);
  Reflect.apply(first.onBeforeRender, first, [
    null,
    null,
    camera
  ]);
}

function segmentCount(
  mesh: BrushMesh
): number {
  const [, border] = edgeLinesOf(mesh);

  return border.geometry.getAttribute("instanceStart").count;
}

describe("BrushMesh", () => {
  test("depth-tests every edge pass so blocks hide the outline", () => {
    const passes = edgeLinesOf(drawnMesh());

    assert.equal(passes.length, 2);
    for (const lines of passes) {
      assert.equal(lines.material.depthTest, true);
      assert.equal(lines.material.depthFunc, THREE.LessEqualDepth);
      assert.equal(lines.material.depthWrite, false);
      assert.equal(lines.material.transparent, false);
    }
  });

  test("backs the border with a wider dark halo", () => {
    const [halo, border] = edgeLinesOf(drawnMesh());

    assert.equal(border.material.linewidth, kEdgeWidth);
    assert.ok(halo.material.linewidth > border.material.linewidth);
    assert.ok(
      halo.material.color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.1
    );
  });

  test("shares one edge geometry across the passes", () => {
    const [halo, border] = edgeLinesOf(drawnMesh());

    assert.equal(halo.geometry, border.geometry);
  });

  test("drops the edges of faces turned away from the camera", () => {
    const mesh = drawnMesh();
    assert.equal(segmentCount(mesh), 12);

    renderFrom(mesh, [20, 20, 20]);
    assert.equal(segmentCount(mesh), 9);

    renderFrom(mesh, [mesh.position.x, 20, mesh.position.z]);
    assert.equal(segmentCount(mesh), 4);
  });

  test("restores the full outline after a reshape until it renders", () => {
    const mesh = drawnMesh();
    renderFrom(mesh, [20, 20, 20]);

    mesh.draw(new BrushFootprint({
      ...kCursor,
      size: 3
    }));
    assert.equal(segmentCount(mesh), 12);

    renderFrom(mesh, [20, 20, 20]);
    assert.equal(segmentCount(mesh), 9);
  });

  test("paints the fill, face and border in the given color", () => {
    const mesh = new BrushMesh({
      color: 0xff0000
    });
    mesh.draw(new BrushFootprint(kCursor));
    const [halo, border] = edgeLinesOf(mesh);
    const surfaces = mesh.children.filter(
      (child) => !(child instanceof LineSegments2)
    );

    assert.equal(surfaces.length, 2);
    for (const surface of surfaces) {
      assert.ok(surface instanceof THREE.Mesh);
      assert.equal(surface.material.color.getHex(), 0xff0000);
    }
    assert.equal(border.material.color.getHex(), 0xff0000);
    assert.notEqual(halo.material.color.getHex(), 0xff0000);
  });

  test("keeps the face highlight on the aimed cell at any size", () => {
    const mesh = new BrushMesh();
    mesh.draw(new BrushFootprint({
      position: {
        x: 2,
        y: 0,
        z: -3
      },
      size: 5,
      pattern: "circle",
      face: CellFace.PosY
    }));

    const [, face] = mesh.children.filter(
      (child) => child instanceof THREE.Mesh &&
        !(child instanceof LineSegments2)
    );
    assert.ok(face instanceof THREE.Mesh);
    assert.equal(face.visible, true);

    const positions = face.geometry.getAttribute("position");
    const bounds = new THREE.Box3()
      .setFromBufferAttribute(positions)
      .translate(mesh.position);
    const expected = [
      [bounds.min.x, 2 - kFaceMargin],
      [bounds.max.x, 3 + kFaceMargin],
      [bounds.min.y, 1 + kFaceMargin],
      [bounds.max.y, 1 + kFaceMargin],
      [bounds.min.z, -3 - kFaceMargin],
      [bounds.max.z, -2 + kFaceMargin]
    ];

    assert.equal(positions.count, 4);
    for (const [actual, wanted] of expected) {
      assert.ok(Math.abs(actual - wanted) < 1e-5);
    }
  });

  test("a subdued brush drops the halo and thins its outline", () => {
    const mesh = new BrushMesh({
      subdued: true
    });
    mesh.draw(new BrushFootprint(kCursor));
    const [halo, border] = edgeLinesOf(mesh);

    assert.equal(halo.visible, false);
    assert.equal(border.visible, true);
    assert.ok(border.material.linewidth < kEdgeWidth);
    assert.ok(border.material.linewidth >= 1);
  });

  test("fades the fill away from the footprint edges", () => {
    const mesh = new BrushMesh();
    mesh.draw(new BrushFootprint({
      ...kCursor,
      size: 3
    }));
    const fill = mesh.children.find(
      (child) => child instanceof THREE.Mesh &&
        child.geometry.hasAttribute("color")
    );

    assert.ok(fill instanceof THREE.Mesh);
    assert.equal(fill.material.vertexColors, true);

    const colors = fill.geometry.getAttribute("color");
    const alphas = new Set<number>();
    for (let index = 0; index < colors.count; index++) {
      alphas.add(colors.getW(index));
    }
    assert.equal(colors.itemSize, 4);
    assert.equal(alphas.size, 2);
    assert.equal(Math.max(...alphas), 1);
    assert.ok(Math.min(...alphas) < 1);
  });

  test("keeps only the face highlight once unshelled", () => {
    const mesh = new BrushMesh();
    mesh.draw(new BrushFootprint({
      ...kCursor,
      size: 1,
      face: CellFace.PosY
    }));
    mesh.shelled = false;
    const [fill, face] = mesh.children.filter(
      (child) => child instanceof THREE.Mesh
    );

    assert.equal(fill.visible, false);
    assert.equal(face.visible, true);
    for (const lines of edgeLinesOf(mesh)) {
      assert.equal(lines.visible, false);
    }

    mesh.shelled = true;
    assert.equal(fill.visible, true);
    assert.equal(edgeLinesOf(mesh)[1].visible, true);
  });
});
