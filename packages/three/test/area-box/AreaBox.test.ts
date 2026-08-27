// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  AreaBox,
  AreaBoxEdges,
  AreaBoxFill,
  AreaBoxLabel
} from "#src/index.ts";

describe("constructor", () => {
  test("anchors the position on the min corner and centers the fill", () => {
    const area = new AreaBox({
      size: { x: 4, y: 1, z: 2 },
      position: { x: 3, y: 0, z: -5 }
    });

    assert.deepEqual(area.position.toArray(), [3, 0, -5]);
    assert.deepEqual(area.fill.scale.toArray(), [4, 1, 2]);
    assert.deepEqual(area.fill.position.toArray(), [2, 0.5, 1]);
  });

  test("draws edges by default and skips them on request", () => {
    assert.ok(new AreaBox().fill instanceof AreaBoxFill);
    assert.ok(new AreaBox().edges instanceof AreaBoxEdges);
    assert.equal(new AreaBox({ edges: { show: false } }).edges, null);
  });

  test("creates a label only when a display name is given", () => {
    assert.equal(new AreaBox().label, null);

    const named = new AreaBox({
      size: { x: 4, y: 2, z: 2 },
      displayName: "Spawn"
    });
    assert.ok(named.label instanceof AreaBoxLabel);
    // Centered on the top face, with vertical clearance.
    assert.deepEqual(named.label.position.toArray(), [2, 2.4, 1]);
  });

  test("defaults to a unit cube at the origin", () => {
    const area = new AreaBox();

    assert.deepEqual(area.size.toArray(), [1, 1, 1]);
    assert.deepEqual(area.position.toArray(), [0, 0, 0]);
  });
});

describe("size", () => {
  test("returns a copy, so mutating it cannot bypass the layout", () => {
    const area = new AreaBox({ size: { x: 2, y: 2, z: 2 } });

    area.size.set(9, 9, 9);

    assert.deepEqual(area.size.toArray(), [2, 2, 2]);
    assert.deepEqual(area.fill.scale.toArray(), [2, 2, 2]);
  });

  test("resizes the fill, the edges and the label together", () => {
    const area = new AreaBox({ displayName: "Zone" });

    area.size = { x: 6, y: 3, z: 4 };

    assert.deepEqual(area.fill.scale.toArray(), [6, 3, 4]);
    assert.deepEqual(area.fill.position.toArray(), [3, 1.5, 2]);
    assert.deepEqual(area.edges!.geometry.boundingBox!.max.toArray(), [6, 3, 4]);
    assert.deepEqual(area.label!.position.toArray(), [3, 3.4, 2]);
  });

  test("never collapses an axis to zero", () => {
    const area = new AreaBox();

    area.size = { x: 0, y: -3, z: 2 };

    assert.ok(area.size.x > 0);
    assert.ok(area.size.y > 0);
  });

  test("leaves the object's own scale alone", () => {
    const area = new AreaBox();

    area.size = { x: 8, y: 8, z: 8 };

    assert.deepEqual(area.scale.toArray(), [1, 1, 1]);
  });
});

describe("box3", () => {
  test("reports parent-space bounds from the min corner", () => {
    const area = new AreaBox({
      size: { x: 4, y: 1, z: 2 },
      position: { x: 3, y: 0, z: -5 }
    });

    const box = area.toBox3();

    assert.deepEqual(box.min.toArray(), [3, 0, -5]);
    assert.deepEqual(box.max.toArray(), [7, 1, -3]);
  });

  test("round-trips through fromBox3", () => {
    const area = new AreaBox();
    const box = new THREE.Box3(
      new THREE.Vector3(-2, 1, 4),
      new THREE.Vector3(2, 3, 10)
    );

    area.fromBox3(box);

    assert.deepEqual(area.position.toArray(), [-2, 1, 4]);
    assert.deepEqual(area.size.toArray(), [4, 2, 6]);
    assert.deepEqual(area.toBox3().max.toArray(), [2, 3, 10]);
  });
});

describe("state", () => {
  test("raises the fill and edge opacity with the emphasis level", () => {
    const area = new AreaBox({ opacity: 0.25, edges: { opacity: 0.5 } });
    const idle = area.fill.material.opacity;

    area.state = "hovered";
    const hovered = area.fill.material.opacity;
    area.state = "active";

    assert.equal(area.state, "active");
    assert.ok(hovered > idle);
    assert.ok(area.fill.material.opacity > hovered);
    assert.ok(area.edges!.material.opacity > 0.5);
  });

  test("never exceeds a fully opaque material", () => {
    const area = new AreaBox({ opacity: 0.98, edges: { opacity: 0.98 } });

    area.state = "active";

    assert.equal(area.fill.material.opacity, 1);
    assert.equal(area.edges!.material.opacity, 1);
  });

  test("returns to idle", () => {
    const area = new AreaBox({ opacity: 0.25 });

    area.state = "active";
    area.state = "idle";

    assert.equal(area.fill.material.opacity, 0.25);
  });
});

describe("dispose", () => {
  test("releases its own resources and leaves foreign children alone", () => {
    const area = new AreaBox({ displayName: "Zone" });
    const foreign = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );
    area.add(foreign);

    let disposedFill = false;
    let disposedForeign = false;
    area.fill.geometry.addEventListener("dispose", () => {
      disposedFill = true;
    });
    foreign.geometry.addEventListener("dispose", () => {
      disposedForeign = true;
    });

    area.dispose();

    assert.equal(disposedFill, true);
    assert.equal(disposedForeign, false);
  });
});

describe("label legibility", () => {
  test("does not tint the nameplate with the area color", () => {
    const area = new AreaBox({
      color: "#8ecf72",
      displayName: "Patrol"
    });

    // A label tinted like the fill it floats over is the hardest one to read.
    assert.equal(new THREE.Color(area.label!.color).getHexString(), "ffffff");
  });
});

describe("render order", () => {
  test("draws the fill and edges above a transparent ground grid", () => {
    const area = new AreaBox();

    // A camera-following grid sorts as the nearest transparent object and
    // would otherwise paint its lines over the area at full strength, which
    // no amount of `opacity` can compensate for.
    assert.ok(area.fill.renderOrder > 0);
    assert.ok(area.edges!.renderOrder > area.fill.renderOrder);
  });
});
