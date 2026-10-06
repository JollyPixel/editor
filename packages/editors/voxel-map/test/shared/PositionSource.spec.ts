// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Vec3Like } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { PositionSource } from "../../src/shared/PositionSource.ts";

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

function toArray(
  position: Vec3Like
): number[] {
  return [position.x, position.y, position.z];
}

describe("PositionSource", () => {
  test("reads a rounded snapshot", () => {
    const source = new PositionSource(
      positionPort({ x: 1.4, y: -2.6, z: 3 })
    );

    assert.deepEqual(toArray(source.read()), [1, -3, 3]);
  });

  test("reads the origin when no layer is selected", () => {
    const source = new PositionSource(positionPort(null));

    assert.deepEqual(toArray(source.read()), [0, 0, 0]);
  });

  test("read returns a fresh object each time", () => {
    const port = positionPort({ x: 1, y: 2, z: 3 });
    const source = new PositionSource(port);

    assert.notEqual(source.read(), source.read());
  });

  test("rounds the committed value before moving", () => {
    const port = positionPort({ x: 0, y: 0, z: 0 });

    new PositionSource(port).write({ x: 2.3, y: 0.5, z: -1.2 });

    assert.deepEqual(port.moves.map(toArray), [[2, 1, -1]]);
  });

  test("skips a move that rounds to the current position", () => {
    const port = positionPort({ x: 2, y: 0, z: 0 });

    new PositionSource(port).write({ x: 2.4, y: 0.1, z: -0.2 });

    assert.deepEqual(port.moves, []);
  });

  test("writes nothing when no layer is selected", () => {
    const port = positionPort(null);

    new PositionSource(port).write({ x: 1, y: 1, z: 1 });

    assert.deepEqual(port.moves, []);
  });
});
