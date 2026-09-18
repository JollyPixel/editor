// Import Node.js Dependencies
import assert from "node:assert/strict";
import {
  describe,
  test
} from "node:test";

// Import Third-party Dependencies
import type {
  VoxelCoord,
  VoxelEngine
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { applyBrushStroke } from "../../../../src/features/painting/interaction/applyBrushStroke.ts";
import { BrushStroke } from "../../../../src/features/painting/model/BrushStroke.ts";

interface FakeEngine {
  engine: VoxelEngine;
  removed: string[];
}

function cellKey(
  cell: VoxelCoord
): string {
  return `${cell.x},${cell.y},${cell.z}`;
}

function createColumnEngine(
  height: number
): FakeEngine {
  const removed: string[] = [];
  const layer = {
    getVoxelAt(position: VoxelCoord) {
      const solid = position.y >= 0 && position.y < height;

      return solid ? { blockId: 1, transform: 0 } : undefined;
    }
  };
  const engine = {
    world: {
      getLayer: () => layer,
      removeVoxelBulk(
        _layerName: string,
        entries: { position: VoxelCoord; }[]
      ) {
        removed.push(...entries.map((entry) => cellKey(entry.position)));
      }
    },
    flush() {
      return undefined;
    }
  };

  return {
    engine: engine as unknown as VoxelEngine,
    removed
  };
}

describe("applyBrushStroke", () => {
  test("digs a wall down from the top face it was aimed at", () => {
    const { engine, removed } = createColumnEngine(6);
    const origin = { x: 0, y: 5, z: 0 };
    const stroke = new BrushStroke({
      mode: "remove",
      layerName: "Ground",
      axis: "yz",
      anchor: "top",
      origin
    });

    assert.ok(applyBrushStroke(engine, stroke, [origin], 3));
    assert.deepStrictEqual(
      [...new Set(removed.map((key) => key.split(",")[1]))].sort(),
      ["3", "4", "5"]
    );
    assert.strictEqual(removed.length, 9);
  });

  test("only reaches the aimed row when the wall rises into the air", () => {
    const { engine, removed } = createColumnEngine(6);
    const origin = { x: 0, y: 5, z: 0 };
    const stroke = new BrushStroke({
      mode: "remove",
      layerName: "Ground",
      axis: "yz",
      origin
    });

    applyBrushStroke(engine, stroke, [origin], 3);

    assert.deepStrictEqual(
      removed.sort(),
      ["0,5,-1", "0,5,0", "0,5,1"]
    );
  });
});
