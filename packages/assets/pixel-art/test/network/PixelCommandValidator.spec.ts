// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { isPixelNetworkCommand } from "#src/network/PixelCommandValidator.ts";

// CONSTANTS
const kTile = { x: 0, y: 0, width: 16, height: 16 };
const kHeader = { clientId: "peer", seq: 0, timestamp: 1 };

function regionCreated(
  faces: unknown,
  activeFaces?: unknown
): unknown {
  return {
    ...kHeader,
    action: "uv-region-created",
    metadata: {
      region: {
        id: "block-1",
        color: "#fff",
        state: "free",
        faces,
        activeFaces
      }
    }
  };
}

function regionMoved(
  face: string
): unknown {
  return {
    ...kHeader,
    action: "uv-region-moved",
    metadata: {
      id: "block-1",
      face,
      rect: kTile
    }
  };
}

function compound(
  parts: unknown[]
): unknown {
  return {
    shape: "compound",
    rect: kTile,
    parts
  };
}

describe("isPixelNetworkCommand — uv regions", () => {
  test("accepts a region carrying a shape's own slots", () => {
    const command = regionCreated(
      { right: kTile, top: kTile, "top.1": kTile },
      ["right", "top", "top.1"]
    );

    assert.equal(isPixelNetworkCommand(command), true);
  });

  test("accepts a compound geometry", () => {
    const command = regionCreated({
      right: compound([
        { x: 0, y: 0, width: 0.5, height: 1 },
        {
          shape: "triangle",
          corner: "top-left",
          rect: { x: 0.5, y: 0, width: 0.5, height: 1 }
        }
      ])
    });

    assert.equal(isPixelNetworkCommand(command), true);
  });

  test("rejects a compound part outside normalized space", () => {
    const command = regionCreated({
      right: compound([{ x: 0.75, y: 0, width: 0.5, height: 1 }])
    });

    assert.equal(isPixelNetworkCommand(command), false);
  });

  test("rejects a compound with no parts", () => {
    assert.equal(isPixelNetworkCommand(regionCreated({ right: compound([]) })), false);
  });

  test("rejects a region with no slot at all", () => {
    assert.equal(isPixelNetworkCommand(regionCreated({})), false);
  });

  test("rejects a slot whose geometry is not a rect", () => {
    const command = regionCreated({ top: { x: 0, y: 0, width: 0, height: 16 } });

    assert.equal(isPixelNetworkCommand(command), false);
  });

  test("rejects an active face the region carries no geometry for", () => {
    const command = regionCreated({ top: kTile }, ["top", "top.1"]);

    assert.equal(isPixelNetworkCommand(command), false);
  });

  test("accepts a move naming a derived slot", () => {
    assert.equal(isPixelNetworkCommand(regionMoved("top.1")), true);
  });

  test("rejects a move naming an empty face", () => {
    assert.equal(isPixelNetworkCommand(regionMoved("")), false);
  });
});
