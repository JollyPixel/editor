// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  AudioGizmo,
  CameraGizmo,
  GizmoIcon,
  LightGizmo,
  type CameraGizmoLens
} from "#src/index.ts";
import { watchDisposal } from "../fixtures/disposal.ts";
import {
  lineSegments,
  strokeColor,
  strokes
} from "../fixtures/lines.ts";

// CONSTANTS
const kLens: CameraGizmoLens = {
  projection: "perspective",
  fov: 60,
  near: 0.1,
  far: 1000,
  orthographicScale: 10
};
const kSelectedColor = "#f5c46b";

type Lines = THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;

function lines(
  gizmo: THREE.Object3D
): Lines {
  const found = gizmo.children.find(
    (child): child is Lines => child instanceof THREE.LineSegments
  );
  assert.ok(found);

  return found;
}

function icon(
  gizmo: THREE.Object3D
): THREE.Sprite {
  const found = gizmo.children.find(
    (child): child is THREE.Sprite => child instanceof THREE.Sprite
  );
  assert.ok(found);

  return found;
}

function bounds(
  object: Lines
): THREE.Box3 {
  object.geometry.computeBoundingBox();

  return object.geometry.boundingBox!;
}

function frustumBounds(
  object: THREE.Object3D
): THREE.Box3 {
  const box = new THREE.Box3();
  for (const segment of lineSegments(object)) {
    box.expandByPoint(segment.start).expandByPoint(segment.end);
  }

  return box;
}

function rectangleHalfHeight(
  object: THREE.Object3D,
  firstSegment: number
): number {
  return Math.max(
    ...lineSegments(object)
      .slice(firstSegment, firstSegment + 4)
      .flatMap(({ start, end }) => [Math.abs(start.y), Math.abs(end.y)])
  );
}

describe("CameraGizmo", () => {
  test("cuts the frustum at the given depth past near and places itself without scale", () => {
    const gizmo = new CameraGizmo({ depth: 2 });
    const matrixWorld = new THREE.Matrix4().compose(
      new THREE.Vector3(1, 2, 3),
      new THREE.Quaternion(),
      new THREE.Vector3(4, 4, 4)
    );

    gizmo.update(kLens, matrixWorld);
    gizmo.updateMatrixWorld();

    assert.ok(Math.abs(frustumBounds(gizmo).min.z + 2.1) < 1e-6);
    assert.deepEqual(
      gizmo.matrixWorld.elements,
      new THREE.Matrix4().makeTranslation(1, 2, 3).elements
    );
  });

  test("draws an orthographic lens as a box as tall as its scale and disposes the perspective lines", () => {
    const gizmo = new CameraGizmo();
    gizmo.update(kLens, new THREE.Matrix4());
    const disposals = watchDisposal(strokes(gizmo)[0].geometry);

    gizmo.update({ ...kLens, projection: "orthographic" }, new THREE.Matrix4());

    assert.strictEqual(rectangleHalfHeight(gizmo, 0), 5);
    assert.strictEqual(rectangleHalfHeight(gizmo, 4), 5);
    assert.deepEqual(disposals, [1]);
  });

  test("draws in the selected color while selected", () => {
    const gizmo = new CameraGizmo({ color: "#ffffff" });

    gizmo.selected = true;
    assert.strictEqual(strokeColor(gizmo), "f5c46b");
    assert.strictEqual(icon(gizmo).material.color.getHexString(), "f5c46b");

    gizmo.selected = false;
    assert.strictEqual(strokeColor(gizmo), "ffffff");
    assert.strictEqual(icon(gizmo).material.color.getHexString(), "ffffff");
  });
});

describe("LightGizmo", () => {
  test("sits on the light's world position and points along its target", () => {
    const parent = new THREE.Group();
    parent.position.set(4, 5, 6);
    parent.rotation.y = Math.PI / 2;
    const light = new THREE.DirectionalLight();
    light.position.set(0, 0, 0);
    light.target.position.set(0, 0, -1);
    light.add(light.target);
    parent.add(light);
    const gizmo = new LightGizmo();

    gizmo.update(light);

    assert.deepEqual(gizmo.position.toArray(), [4, 5, 6]);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(gizmo.quaternion);
    assert.ok(forward.distanceTo(new THREE.Vector3(-1, 0, 0)) < 1e-6);
  });

  test("tints its icon with the light color, and with the selected color while selected", () => {
    const gizmo = new LightGizmo({ selectedColor: kSelectedColor });
    gizmo.update(new THREE.PointLight("#3366ff"));

    assert.strictEqual(icon(gizmo).material.color.getHexString(), "3366ff");

    gizmo.selected = true;
    assert.strictEqual(icon(gizmo).material.color.getHexString(), "f5c46b");
  });

  test("shows a spot light's cone, sized by its range and angle, only while selected", () => {
    const gizmo = new LightGizmo();
    gizmo.update(new THREE.SpotLight("#ffffff", 1, 4, Math.PI / 4));
    const shape = lines(gizmo);

    assert.strictEqual(shape.visible, false);

    gizmo.selected = true;
    const box = bounds(shape);
    assert.strictEqual(shape.visible, true);
    assert.ok(Math.abs(box.min.z + 4) < 1e-6);
    assert.ok(Math.abs(box.max.x - 4) < 1e-6);
  });

  test("draws a light panel icon for a rect area light", () => {
    const gizmo = new LightGizmo();

    gizmo.update(new THREE.RectAreaLight("#ffffff", 1, 2, 1));

    const sprite = icon(gizmo);
    assert.ok(sprite instanceof GizmoIcon);
    assert.strictEqual(sprite.glyph, "rect-area");
  });

  test("draws no range for a point light without a distance and disposes the previous range", () => {
    const gizmo = new LightGizmo();
    gizmo.update(new THREE.PointLight("#ffffff", 1, 3));
    const disposals = watchDisposal(lines(gizmo).geometry);
    assert.ok(Math.abs(bounds(lines(gizmo)).max.x - 3) < 1e-6);

    gizmo.update(new THREE.PointLight());

    assert.strictEqual(lines(gizmo).geometry.getAttribute("position").count, 0);
    assert.deepEqual(disposals, [1]);
  });
});

describe("AudioGizmo", () => {
  test("sits on the given position, tinted with the given color or the selected color", () => {
    const gizmo = new AudioGizmo({ selectedColor: kSelectedColor });

    gizmo.update(new THREE.Vector3(1, 2, 3), "#3366ff");

    assert.deepEqual(gizmo.position.toArray(), [1, 2, 3]);
    assert.strictEqual(icon(gizmo).material.color.getHexString(), "3366ff");

    gizmo.selected = true;
    assert.strictEqual(icon(gizmo).material.color.getHexString(), "f5c46b");

    gizmo.selected = false;
    assert.strictEqual(icon(gizmo).material.color.getHexString(), "3366ff");
  });
});

describe("GizmoIcon", () => {
  test("disposes its own material and keeps the glyph other icons draw", () => {
    const disposed = new GizmoIcon("camera", kSelectedColor);
    const kept = new GizmoIcon("camera", kSelectedColor);
    const disposals = watchDisposal(
      disposed.material,
      kept.material.map ?? undefined
    );

    disposed.dispose();

    assert.deepEqual(disposals, [1, 0]);
  });
});
