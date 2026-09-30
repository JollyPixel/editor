// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  createPixelReconciler,
  narrowPixelCommand,
  pixelCommandKeys
} from "#src/network/client.ts";
import type { PixelNetworkCommand } from "#src/network/types.ts";
import {
  command,
  gray,
  packed,
  stackedRegion,
  wholeCanvasCommands
} from "../fixtures/commands.ts";

function stroke(): ReturnType<typeof packed> {
  return packed(command("stroke", {
    color: gray(0),
    positions: [{ x: 1, y: 2 }, { x: 3, y: 4 }]
  }));
}

describe("pixelCommandKeys", () => {
  test("keys a stroke and a select-edit by painted position", () => {
    assert.deepStrictEqual(pixelCommandKeys(stroke()), ["1,2", "3,4"]);
    assert.deepStrictEqual(
      pixelCommandKeys(packed(command("select-edit", {
        positions: [{ x: 0, y: 5 }],
        colors: [gray(9)]
      }))),
      ["0,5"]
    );
  });

  test("keys a UV region write by region and slot", () => {
    assert.deepStrictEqual(
      pixelCommandKeys(command("uv-region-state-changed", {
        region: stackedRegion("r1")
      }))?.slice(0, 1),
      [JSON.stringify(["r1", null])]
    );
  });

  test("returns null for structural commands", () => {
    for (const structural of wholeCanvasCommands()) {
      assert.strictEqual(pixelCommandKeys(structural), null);
    }
    assert.strictEqual(
      pixelCommandKeys(command("uv-region-deleted", { id: "r1" })),
      null
    );
  });
});

describe("narrowPixelCommand", () => {
  test("keeps the painted entries at the given indices", () => {
    const narrowed = narrowPixelCommand(stroke(), [1]);

    assert.deepStrictEqual(pixelCommandKeys(narrowed!), ["3,4"]);
  });

  test("cannot narrow a UV region write", () => {
    assert.strictEqual(
      narrowPixelCommand(command("uv-region-state-changed", {
        region: stackedRegion("r1")
      }), [0]),
      null
    );
  });
});

describe("createPixelReconciler", () => {
  test("replays a command through the remote apply path", () => {
    const applied: PixelNetworkCommand[] = [];
    const reconciler = createPixelReconciler({
      applyRemoteCommand: (event) => applied.push(event as PixelNetworkCommand)
    });

    assert.strictEqual(reconciler.replay(stroke()), true);
    assert.deepStrictEqual(applied[0].metadata, {
      color: gray(0),
      positions: [{ x: 1, y: 2 }, { x: 3, y: 4 }]
    });
  });

  test("reverts absolute writes in place and refuses buffer-wide commands", () => {
    const reconciler = createPixelReconciler({
      applyRemoteCommand: () => void 0
    });

    assert.strictEqual(reconciler.revert([stroke()]), true);
    for (const structural of wholeCanvasCommands()) {
      assert.strictEqual(reconciler.revert([stroke(), structural]), false);
    }
  });
});
