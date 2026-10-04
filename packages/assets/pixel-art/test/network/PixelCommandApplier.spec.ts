// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  encodePixelBytes,
  PixelBuffer,
  PixelDocument,
  PixelDocumentState,
  UVRegion
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { applyPixelCommand } from "#src/network/PixelCommandApplier.ts";
import { unpackPixelCommand } from "#src/network/PixelWireCodec.ts";
import {
  command,
  freeRegion,
  gray,
  stackedRegion
} from "../fixtures/commands.ts";

function makeState(
  size = { x: 8, y: 8 }
): PixelDocumentState {
  return new PixelDocumentState({
    buffer: new PixelBuffer({ size })
  });
}

describe("applyPixelCommand", () => {
  test("stroke draws its color at every position", () => {
    const state = makeState();

    applyPixelCommand(state, command("stroke", {
      color: { r: 1, g: 2, b: 3, a: 255 },
      positions: [{ x: 0, y: 0 }, { x: 1, y: 1 }]
    }));

    assert.deepStrictEqual(state.buffer.samplePixel(0, 0), [1, 2, 3, 255]);
    assert.deepStrictEqual(state.buffer.samplePixel(1, 1), [1, 2, 3, 255]);
  });

  test("select-edit writes each position's own color", () => {
    const state = makeState();

    applyPixelCommand(state, command("select-edit", {
      positions: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      colors: [gray(1), gray(9)]
    }));

    assert.deepStrictEqual(state.buffer.samplePixel(0, 0), [1, 1, 1, 255]);
    assert.deepStrictEqual(state.buffer.samplePixel(1, 0), [9, 9, 9, 255]);
  });

  test("resized resizes the state", () => {
    const state = makeState();

    applyPixelCommand(state, command("resized", { size: { x: 8, y: 2 } }));

    assert.deepStrictEqual(state.buffer.size(), { x: 8, y: 2 });
  });

  test("texture-replaced replaces the state size and pixels", () => {
    const state = makeState();
    const pixels = new Uint8Array(2 * 2 * 4).fill(9);

    applyPixelCommand(state, command("texture-replaced", {
      size: { x: 2, y: 2 },
      pixels: encodePixelBytes(pixels)
    }));

    assert.deepStrictEqual(state.buffer.size(), { x: 2, y: 2 });
    assert.deepStrictEqual(state.buffer.samplePixel(0, 0), [9, 9, 9, 9]);
  });

  test("global-fill repaints only the pixels matching fromColor", () => {
    const state = makeState({ x: 3, y: 1 });
    state.buffer.drawPixels([{ x: 0, y: 0 }, { x: 1, y: 0 }], gray(1));
    state.buffer.drawPixels([{ x: 2, y: 0 }], gray(5));

    applyPixelCommand(state, command("global-fill", {
      fromColor: gray(1),
      toColor: gray(9)
    }));

    assert.deepStrictEqual(state.buffer.samplePixel(0, 0), [9, 9, 9, 255]);
    assert.deepStrictEqual(state.buffer.samplePixel(1, 0), [9, 9, 9, 255]);
    assert.deepStrictEqual(state.buffer.samplePixel(2, 0), [5, 5, 5, 255]);
  });

  test("uv-region-created stores the region", () => {
    const state = makeState();

    applyPixelCommand(state, command("uv-region-created", { region: stackedRegion("r1") }));

    assert.deepStrictEqual(state.uv.get("r1")?.toJSON(), stackedRegion("r1"));
  });

  test("uv-region-deleted removes the region", () => {
    const state = makeState();
    state.uv.restore(stackedRegion("r1"));

    applyPixelCommand(state, command("uv-region-deleted", { id: "r1" }));

    assert.strictEqual(state.uv.get("r1"), undefined);
  });

  test("uv-region-moved updates the region rect and keeps its color", () => {
    const state = makeState();
    const rect = { x: 4, y: 4, width: 2, height: 2 };
    state.uv.restore(stackedRegion("r1"));

    applyPixelCommand(state, command("uv-region-moved", { id: "r1", face: null, rect }));

    assert.deepStrictEqual(state.uv.get("r1")?.toJSON(), stackedRegion("r1", rect));
  });

  test("uv-region-moved clamps the region inside the texture like a pixel document", () => {
    const state = makeState();
    const document = new PixelDocument({ size: { x: 8, y: 8 } });
    const moved = command("uv-region-moved", {
      id: "r1",
      face: null,
      rect: { x: 7, y: 7, width: 2, height: 2 }
    });
    state.uv.restore(stackedRegion("r1"));
    document.uv.restore(stackedRegion("r1"));

    applyPixelCommand(state, moved);
    document.applyRemoteCommand(unpackPixelCommand(moved));

    assert.deepStrictEqual(state.uv.get("r1")?.bounds, { x: 6, y: 6, width: 2, height: 2 });
    assert.deepStrictEqual(state.uv.get("r1")?.toJSON(), document.uv.get("r1")?.toJSON());
  });

  test("uv-region-moved moves a single face of a free region", () => {
    const state = makeState();
    state.uv.restore(new UVRegion(stackedRegion("r1")).free());

    applyPixelCommand(state, command("uv-region-moved", {
      id: "r1",
      face: "top",
      rect: { x: 4, y: 4, width: 2, height: 2 }
    }));

    const region = state.uv.get("r1")!;
    assert.deepStrictEqual(region.rectFor("top"), { x: 4, y: 4, width: 2, height: 2 });
    assert.deepStrictEqual(region.rectFor("front"), { x: 0, y: 0, width: 2, height: 2 });
  });

  test("uv-region-state-changed replaces the stored region", () => {
    const state = makeState();
    state.uv.restore(stackedRegion("r1"));

    applyPixelCommand(state, command("uv-region-state-changed", { region: freeRegion("r1") }));

    assert.strictEqual(state.uv.get("r1")?.state, "free");
  });

  test("region commands for an unknown region are no-ops", () => {
    const state = makeState();

    assert.doesNotThrow(() => {
      applyPixelCommand(state, command("uv-region-deleted", { id: "missing" }));
      applyPixelCommand(state, command("uv-region-moved", {
        id: "missing",
        face: null,
        rect: { x: 0, y: 0, width: 1, height: 1 }
      }));
    });
  });
});

describe("applyPixelCommand — uv rotation", () => {
  test("uv-region-moved keeps the stored size", () => {
    const state = makeState();
    state.uv.restore(new UVRegion(stackedRegion("r1")).rotated("cw"));

    applyPixelCommand(state, command("uv-region-moved", {
      id: "r1",
      face: null,
      rect: { x: 4, y: 4, width: 6, height: 1 }
    }));

    assert.deepStrictEqual(
      state.uv.get("r1")!.geometryFor("front"),
      { x: 4, y: 4, width: 2, height: 2, rotation: 1 }
    );
  });

  test("a slot rotation replaces only that slot geometry", () => {
    const state = makeState();
    state.uv.restore(freeRegion("r1"));
    const geometry = { x: 0, y: 0, width: 2, height: 2, rotation: 1 as const };

    applyPixelCommand(state, command("uv-region-rotated", {
      id: "r1",
      face: "top",
      geometry
    }));

    const region = state.uv.get("r1")!;
    assert.deepStrictEqual(region.geometryFor("top"), geometry);
    assert.strictEqual(region.geometryFor("front").rotation, undefined);
  });

  test("a region rotation replaces the stored region", () => {
    const state = makeState();
    state.uv.restore(stackedRegion("r1"));
    const rotated = new UVRegion(stackedRegion("r1")).rotated("ccw").toJSON();

    applyPixelCommand(state, command("uv-region-rotated", {
      id: "r1",
      face: null,
      region: rotated
    }));

    assert.deepStrictEqual(state.uv.get("r1")!.toJSON(), rotated);
  });

  test("a slot rotation of an unknown region is a no-op", () => {
    const state = makeState();

    assert.doesNotThrow(() => applyPixelCommand(state, command("uv-region-rotated", {
      id: "missing",
      face: "top",
      geometry: { x: 0, y: 0, width: 1, height: 1 }
    })));
  });
});
