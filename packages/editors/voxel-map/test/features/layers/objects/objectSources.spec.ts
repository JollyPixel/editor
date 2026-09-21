// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { VoxelObjectJSON } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { derivedColorOf } from "../../../../src/features/layers/objects/objectArea.ts";
import {
  objectColorSource,
  objectPositionSource,
  objectSizeSource,
  type ObjectPort
} from "../../../../src/features/layers/objects/objectSources.ts";

function objectPort(
  object: VoxelObjectJSON | null
): ObjectPort & { patches: Partial<VoxelObjectJSON>[]; } {
  return {
    patches: [],
    object: () => object,
    patch(patch) {
      this.patches.push(patch);
    }
  };
}

function anObject(
  overrides: Partial<VoxelObjectJSON> = {}
): VoxelObjectJSON {
  return {
    id: "object-1",
    name: "Area",
    x: 2,
    y: 0,
    z: 3,
    visible: true,
    ...overrides
  };
}

describe("objectColorSource", () => {
  test("reads the explicit color when the object carries one", () => {
    const source = objectColorSource(
      objectPort(anObject({ color: "#ff0000" }))
    );

    assert.equal(source.read(), "#ff0000");
  });

  test("reads the derived color when the object carries none", () => {
    const object = anObject();
    const source = objectColorSource(objectPort(object));

    assert.equal(source.read(), derivedColorOf(object));
  });

  test("clears the color when the committed value is the derived one", () => {
    const object = anObject({ color: "#ff0000" });
    const port = objectPort(object);

    objectColorSource(port).write(derivedColorOf(object), true);

    assert.deepEqual(port.patches, [{ color: undefined }]);
  });

  test("ignores the case of the committed value", () => {
    const object = anObject({ color: "#ff0000" });
    const port = objectPort(object);

    objectColorSource(port).write(
      derivedColorOf(object).toUpperCase(),
      true
    );

    assert.deepEqual(port.patches, [{ color: undefined }]);
  });

  test("patches an explicit color that differs from the derived one", () => {
    const port = objectPort(anObject());

    objectColorSource(port).write("#00ff00", true);

    assert.deepEqual(port.patches, [{ color: "#00ff00" }]);
  });

  test("skips a patch that changes nothing", () => {
    const port = objectPort(anObject({ color: "#00ff00" }));

    objectColorSource(port).write("#00ff00", true);

    assert.deepEqual(port.patches, []);
  });
});

describe("objectPositionSource", () => {
  test("reads the object's cell as a fresh snapshot", () => {
    const source = objectPositionSource(objectPort(anObject()));

    assert.deepEqual(source.read(), { x: 2, y: 0, z: 3 });
    assert.notEqual(source.read(), source.read());
  });

  test("reads the origin with no object", () => {
    const source = objectPositionSource(objectPort(null));

    assert.deepEqual(source.read(), { x: 0, y: 0, z: 0 });
  });

  test("rounds the committed value", () => {
    const port = objectPort(anObject());

    objectPositionSource(port).write({ x: 4.6, y: 1.2, z: 3.4 }, true);

    assert.deepEqual(port.patches, [{ x: 5, y: 1, z: 3 }]);
  });

  test("skips a move that rounds back onto the object", () => {
    const port = objectPort(anObject());

    objectPositionSource(port).write({ x: 2.1, y: -0.2, z: 3 }, true);

    assert.deepEqual(port.patches, []);
  });

  test("writes nothing with no object", () => {
    const port = objectPort(null);

    objectPositionSource(port).write({ x: 1, y: 1, z: 1 }, true);

    assert.deepEqual(port.patches, []);
  });
});

describe("objectSizeSource", () => {
  test("reads the footprint on the xz plane", () => {
    const source = objectSizeSource(
      objectPort(anObject({ width: 4, height: 2 }))
    );

    assert.deepEqual(source.read(), { x: 4, z: 2 });
  });

  test("reads a unit footprint with no object", () => {
    const source = objectSizeSource(objectPort(null));

    assert.deepEqual(source.read(), { x: 1, z: 1 });
  });

  test("patches the footprint from the committed plane", () => {
    const port = objectPort(anObject({ width: 1, height: 1 }));

    objectSizeSource(port).write({ x: 3, z: 5 }, true);

    assert.deepEqual(port.patches, [{ width: 3, height: 5 }]);
  });
});
