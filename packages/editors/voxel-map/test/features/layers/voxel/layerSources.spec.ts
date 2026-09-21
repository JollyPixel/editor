// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Vec3Like } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  gizmoSource,
  layerPositionSource,
  roundPosition,
  samePosition
} from "../../../../src/features/layers/voxel/layerSources.ts";

function positionPort(
  start: Vec3Like | null
): { moves: Vec3Like[]; position(): Vec3Like | null; move(next: Vec3Like): void; } {
  let current = start;

  return {
    moves: [],
    position: () => current,
    move(next) {
      this.moves.push(next);
      current = next;
    }
  };
}

describe("layerPositionSource", () => {
  test("reads a rounded snapshot", () => {
    const source = layerPositionSource(
      positionPort({ x: 1.4, y: -2.6, z: 3 })
    );

    assert.deepEqual(source.read(), { x: 1, y: -3, z: 3 });
  });

  test("reads the origin when no layer is selected", () => {
    const source = layerPositionSource(positionPort(null));

    assert.deepEqual(source.read(), { x: 0, y: 0, z: 0 });
  });

  test("read returns a fresh object each time", () => {
    const port = positionPort({ x: 1, y: 2, z: 3 });
    const source = layerPositionSource(port);

    assert.notEqual(source.read(), source.read());
  });

  test("rounds the committed value before moving", () => {
    const port = positionPort({ x: 0, y: 0, z: 0 });

    layerPositionSource(port).write({ x: 2.3, y: 0.5, z: -1.2 }, true);

    assert.deepEqual(port.moves, [{ x: 2, y: 1, z: -1 }]);
  });

  test("skips a move that rounds to the current position", () => {
    const port = positionPort({ x: 2, y: 0, z: 0 });

    layerPositionSource(port).write({ x: 2.4, y: 0.1, z: -0.2 }, true);

    assert.deepEqual(port.moves, []);
  });

  test("writes nothing when no layer is selected", () => {
    const port = positionPort(null);

    layerPositionSource(port).write({ x: 1, y: 1, z: 1 }, true);

    assert.deepEqual(port.moves, []);
  });
});

describe("gizmoSource", () => {
  test("reads and writes through the port", () => {
    let enabled = false;
    const source = gizmoSource({
      enabled: () => enabled,
      toggle: (value) => {
        enabled = value;
      }
    });

    assert.equal(source.read(), false);
    source.write(true, true);
    assert.equal(source.read(), true);
  });
});

describe("roundPosition and samePosition", () => {
  test("rounds every axis", () => {
    assert.deepEqual(
      roundPosition({ x: -0.5, y: 1.5, z: 2.49 }),
      { x: -0, y: 2, z: 2 }
    );
  });

  test("compares axis by axis", () => {
    const left = { x: 1, y: 2, z: 3 };

    assert.equal(samePosition(left, { x: 1, y: 2, z: 3 }), true);
    assert.equal(samePosition(left, { x: 1, y: 2, z: 4 }), false);
  });
});
