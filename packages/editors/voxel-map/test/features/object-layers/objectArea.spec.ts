// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type { VoxelObjectJSON } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  areaTransformOf,
  colorOf,
  createObjectAt,
  derivedColorOf,
  isLocked,
  objectKey,
  objectPatchFromArea,
  parseObjectKey,
  sameObjectArea
} from "../../../src/features/object-layers/objectArea.ts";

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

describe("createObjectAt", () => {
  test("fills the cell it is given with a visible 1x1 object", () => {
    const object = createObjectAt("Spawn", {
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
    const object = createObjectAt("Spawn", {
      x: 12.4,
      y: -0.2,
      z: -7.6
    });

    assert.equal(object.x, 12);
    assert.equal(object.y, 0);
    assert.equal(object.z, -8);
  });
});

describe("objectKey", () => {
  test("round-trips a key holding a colon in the layer name", () => {
    const key = objectKey("zone:north", "obj-1");

    assert.equal(key, "zone:north:obj-1");
    assert.deepEqual(parseObjectKey(key), {
      layerName: "zone:north",
      objectId: "obj-1"
    });
  });
});

describe("areaTransformOf", () => {
  test("anchors the area on the object min corner", () => {
    const { position, size } = areaTransformOf(createObject());

    assert.deepEqual(position, { x: 2, y: 0, z: -4 });
    assert.deepEqual(size, { x: 3, y: 1, z: 5 });
  });

  test("defaults and normalizes missing or invalid extents", () => {
    const { size } = areaTransformOf(createObject({
      width: undefined,
      height: 0
    }));

    assert.deepEqual(size, { x: 1, y: 1, z: 1 });
  });
});

describe("objectPatchFromArea", () => {
  test("rounds the min corner and reads width and height off X and Z", () => {
    const patch = objectPatchFromArea(
      { x: 1.6, y: -0.2, z: 4.4 },
      { x: 3.2, y: 1, z: 6.7 }
    );

    assert.deepEqual(patch, {
      x: 2,
      y: 0,
      z: 4,
      width: 3,
      height: 7
    });
  });

  test("keeps a degenerate size at one unit", () => {
    const patch = objectPatchFromArea(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: -2 }
    );

    assert.equal(patch.width, 1);
    assert.equal(patch.height, 1);
  });
});

describe("sameObjectArea", () => {
  const patch = {
    x: 2,
    y: 0,
    z: -4,
    width: 3,
    height: 5
  };

  test("matches an object already at the patched area", () => {
    assert.equal(sameObjectArea(createObject(), patch), true);
  });

  test("matches an implicit unit extent against its normalized value", () => {
    const object = createObject({
      width: undefined,
      height: undefined
    });

    assert.equal(
      sameObjectArea(object, { ...patch, width: 1, height: 1 }),
      true
    );
  });

  test("rejects a moved or resized object", () => {
    assert.equal(sameObjectArea(createObject({ x: 3 }), patch), false);
    assert.equal(sameObjectArea(createObject({ height: 6 }), patch), false);
  });
});

describe("colorOf", () => {
  test("derives a stable hue from the id when no color is set", () => {
    const object = createObject();

    const derived = colorOf(object);

    assert.match(derived, /^#[0-9a-f]{6}$/i);
    assert.equal(colorOf(createObject()), derived);
    assert.notEqual(colorOf(createObject({ id: "other" })), derived);
  });

  test("prefers an explicit color over the derived one", () => {
    assert.equal(colorOf(createObject({ color: "#ff0000" })), "#ff0000");
  });
});

describe("isLocked", () => {
  test("treats an absent flag as unlocked", () => {
    assert.equal(isLocked(createObject()), false);
    assert.equal(isLocked(createObject({ locked: false })), false);
    assert.equal(isLocked(createObject({ locked: true })), true);
  });
});

describe("derivedColorOf", () => {
  test("ignores an explicit color, so a field can offer it as the default", () => {
    const object = createObject({ color: "#ff0000" });

    assert.equal(derivedColorOf(object), derivedColorOf(createObject()));
    assert.notEqual(derivedColorOf(object), "#ff0000");
  });
});
