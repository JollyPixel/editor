// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type { VoxelObjectJSON } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { MapObject } from "../../../../src/features/layers/objects/MapObject.ts";

function createObject(
  patch: Partial<VoxelObjectJSON> = {}
): VoxelObjectJSON {
  return {
    id: "obj-1",
    name: "Spawn",
    x: 2,
    y: 0,
    z: -4,
    width: 3,
    height: 5,
    visible: true,
    ...patch
  };
}

describe("MapObject.create", () => {
  test("fills the cell it is given with a visible 1x1 object", () => {
    const object = MapObject.create("Spawn", {
      x: 12,
      y: 4,
      z: -8
    });

    assert.equal(object.name, "Spawn");
    assert.equal(object.visible, true);
    assert.equal(object.x, 12);
    assert.equal(object.y, 4);
    assert.equal(object.z, -8);
    assert.equal(object.width, undefined);
    assert.equal(object.height, undefined);
    assert.ok(object.id.length > 0);
  });

  test("snaps a fractional focus point to whole cells", () => {
    const object = MapObject.create("Spawn", {
      x: 12.4,
      y: -0.2,
      z: -7.6
    });

    assert.equal(object.x, 12);
    assert.equal(object.y, 0);
    assert.equal(object.z, -8);
  });
});

describe("MapObject.area", () => {
  test("anchors the area on the object min corner", () => {
    const { position, size } = new MapObject(createObject()).area;

    assert.deepEqual(position, { x: 2, y: 0, z: -4 });
    assert.deepEqual(size, { x: 3, y: 1, z: 5 });
  });

  test("defaults and normalizes missing or invalid extents", () => {
    const { size } = new MapObject(createObject({
      width: undefined,
      height: 0
    })).area;

    assert.deepEqual(size, { x: 1, y: 1, z: 1 });
  });
});

describe("MapObject.areaPatch", () => {
  test("rounds the min corner and reads width and height off X and Z", () => {
    const patch = MapObject.areaPatch({ x: 1.6, y: -0.2, z: 4.4 }, { x: 3.2, y: 1, z: 6.7 });

    assert.deepEqual(patch, {
      x: 2,
      y: 0,
      z: 4,
      width: 3,
      height: 7
    });
  });

  test("keeps a degenerate size at one unit", () => {
    const patch = MapObject.areaPatch({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: -2 });

    assert.equal(patch.width, 1);
    assert.equal(patch.height, 1);
  });
});

describe("MapObject.hasArea", () => {
  const patch = {
    x: 2,
    y: 0,
    z: -4,
    width: 3,
    height: 5
  };

  test("matches an object already at the patched area", () => {
    assert.equal(new MapObject(createObject()).hasArea(patch), true);
  });

  test("matches an implicit unit extent against its normalized value", () => {
    const object = createObject({
      width: undefined,
      height: undefined
    });

    assert.equal(
      new MapObject(object).hasArea({ ...patch, width: 1, height: 1 }),
      true
    );
  });

  test("rejects a moved or resized object", () => {
    assert.equal(new MapObject(createObject({ x: 3 })).hasArea(patch), false);
    assert.equal(new MapObject(createObject({ height: 6 })).hasArea(patch), false);
  });
});

describe("MapObject.color", () => {
  test("derives a stable hue from the id when no color is set", () => {
    const object = createObject();

    const derived = new MapObject(object).color;

    assert.match(derived, /^#[0-9a-f]{6}$/i);
    assert.equal(new MapObject(createObject()).color, derived);
    assert.notEqual(new MapObject(createObject({ id: "other" })).color, derived);
  });

  test("prefers an explicit color over the derived one", () => {
    assert.equal(new MapObject(createObject({ color: "#ff0000" })).color, "#ff0000");
  });
});

describe("MapObject.locked", () => {
  test("treats an absent flag as unlocked", () => {
    assert.equal(new MapObject(createObject()).locked, false);
    assert.equal(new MapObject(createObject({ locked: false })).locked, false);
    assert.equal(new MapObject(createObject({ locked: true })).locked, true);
  });
});

describe("MapObject.derivedColor", () => {
  test("ignores an explicit color, so a field can offer it as the default", () => {
    const object = createObject({ color: "#ff0000" });

    assert.equal(new MapObject(object).derivedColor, new MapObject(createObject()).derivedColor);
    assert.notEqual(new MapObject(object).derivedColor, "#ff0000");
  });
});

describe("MapObject.isNoop", () => {
  test("accepts a patch whose every primitive field already matches", () => {
    const object = createObject();

    assert.equal(new MapObject(object).isNoop({ x: 2, z: -4 }), true);
    assert.equal(new MapObject(object).isNoop({ color: undefined }), true);
  });

  test("rejects a patch changing at least one field", () => {
    const object = createObject();

    assert.equal(new MapObject(object).isNoop({ x: 2, z: 0 }), false);
    assert.equal(new MapObject(object).isNoop({ color: "#ff0000" }), false);
  });

  test("never treats an object value as unchanged", () => {
    const properties = { kind: "spawn" };
    const object = createObject({ properties });

    assert.equal(new MapObject(object).isNoop({ properties }), false);
  });

  test("rejects an empty patch", () => {
    assert.equal(new MapObject(createObject()).isNoop({}), false);
  });
});
