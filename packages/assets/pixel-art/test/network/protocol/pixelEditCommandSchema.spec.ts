// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { pixelEditCommandSchema } from "#src/network/protocol/PixelCommand.schema.ts";
import { gray } from "../../fixtures/commands.ts";

// CONSTANTS
const kTile = { x: 0, y: 0, width: 16, height: 16 };

describe("pixelEditCommandSchema", () => {
  test("accepts every document variant of an action", () => {
    const rotations = [
      {
        id: "block-1",
        face: "top",
        geometry: { ...kTile, rotation: 1 }
      },
      {
        id: "block-1",
        face: null,
        region: {
          id: "block-1",
          color: "#fff",
          state: "stacked",
          rect: { ...kTile, rotation: 2 }
        }
      }
    ];

    for (const metadata of rotations) {
      const parsed = pixelEditCommandSchema.safeParse({
        action: "uv-region-rotated",
        metadata
      });
      assert.ok(parsed.success);
    }
  });

  test("rejects the packed wire stroke and the binary texture replacement", () => {
    const packedStroke = pixelEditCommandSchema.safeParse({
      action: "stroke",
      metadata: {
        color: gray(1),
        xy: [0, 0]
      }
    });
    const replaced = pixelEditCommandSchema.safeParse({
      action: "texture-replaced",
      metadata: {
        size: { x: 1, y: 1 },
        pixels: new Uint8Array(4)
      }
    });

    assert.strictEqual(packedStroke.success, false);
    assert.strictEqual(replaced.success, false);
  });
});
