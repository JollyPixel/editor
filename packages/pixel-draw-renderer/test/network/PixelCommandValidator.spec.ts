// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  isPixelNetworkCommand
} from "../../src/network/PixelCommandValidator.ts";

// CONSTANTS
const kTile = { x: 0, y: 0, width: 16, height: 16 };

function regionCommand(
  region: unknown
) {
  return {
    action: "uv-region-created",
    clientId: "peer",
    seq: 0,
    timestamp: 1,
    metadata: { region }
  };
}

describe("isPixelNetworkCommand — uv regions", () => {
  test("accepts a region carrying a shape's own slots", () => {
    assert.equal(
      isPixelNetworkCommand(regionCommand({
        id: "block-1",
        color: "#fff",
        state: "free",
        faces: {
          right: kTile,
          top: kTile,
          "top.1": kTile
        },
        activeFaces: ["right", "top", "top.1"]
      })),
      true
    );
  });

  test("accepts a compound geometry", () => {
    assert.equal(
      isPixelNetworkCommand(regionCommand({
        id: "block-1",
        color: "#fff",
        state: "free",
        faces: {
          right: {
            shape: "compound",
            rect: kTile,
            parts: [
              { x: 0, y: 0, width: 0.5, height: 1 },
              {
                shape: "triangle",
                corner: "top-left",
                rect: { x: 0.5, y: 0, width: 0.5, height: 1 }
              }
            ]
          }
        }
      })),
      true
    );
  });

  test("rejects a compound part outside normalized space", () => {
    assert.equal(
      isPixelNetworkCommand(regionCommand({
        id: "block-1",
        color: "#fff",
        state: "free",
        faces: {
          right: {
            shape: "compound",
            rect: kTile,
            parts: [
              { x: 0.75, y: 0, width: 0.5, height: 1 }
            ]
          }
        }
      })),
      false
    );
  });

  test("rejects a compound with no parts", () => {
    assert.equal(
      isPixelNetworkCommand(regionCommand({
        id: "block-1",
        color: "#fff",
        state: "free",
        faces: {
          right: {
            shape: "compound",
            rect: kTile,
            parts: []
          }
        }
      })),
      false
    );
  });

  test("rejects a region with no slot at all", () => {
    assert.equal(
      isPixelNetworkCommand(regionCommand({
        id: "block-1",
        color: "#fff",
        state: "free",
        faces: {}
      })),
      false
    );
  });

  test("rejects a slot whose geometry is not a rect", () => {
    assert.equal(
      isPixelNetworkCommand(regionCommand({
        id: "block-1",
        color: "#fff",
        state: "free",
        faces: { top: { x: 0, y: 0, width: 0, height: 16 } }
      })),
      false
    );
  });

  test("rejects an active face the region carries no geometry for", () => {
    assert.equal(
      isPixelNetworkCommand(regionCommand({
        id: "block-1",
        color: "#fff",
        state: "free",
        faces: { top: kTile },
        activeFaces: ["top", "top.1"]
      })),
      false
    );
  });

  test("accepts a move naming a derived slot", () => {
    assert.equal(
      isPixelNetworkCommand({
        action: "uv-region-moved",
        clientId: "peer",
        seq: 0,
        timestamp: 1,
        metadata: {
          id: "block-1",
          face: "top.1",
          rect: kTile
        }
      }),
      true
    );
  });

  test("rejects a move naming an empty face", () => {
    assert.equal(
      isPixelNetworkCommand({
        action: "uv-region-moved",
        clientId: "peer",
        seq: 0,
        timestamp: 1,
        metadata: {
          id: "block-1",
          face: "",
          rect: kTile
        }
      }),
      false
    );
  });
});
