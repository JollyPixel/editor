// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  PixelArtCanvas,
  PixelArtCanvasOptions
} from "#src/PixelArtCanvas.ts";
import type { PixelBufferHookEvent } from "#src/buffer/hooks.ts";
import { createPixelArtCanvas } from "./helpers/canvas.ts";
import {
  hoverCanvas,
  mouseEvent
} from "./helpers/events.ts";
import {
  rotateCounterClockwiseKey,
  rotateKey
} from "./helpers/select.ts";

describe("PixelArtCanvas — uv rotation", () => {
  /*
   * 200x200 container, 8x8 texture, zoom 4 -> centered camera (84, 84).
   * client 84 + n*4 -> texture n.
   */

  function makeManager(
    options: PixelArtCanvasOptions = {}
  ): PixelArtCanvas {
    return createPixelArtCanvas({
      zoom: { default: 4 },
      history: { enabled: true },
      ...options
    }).manager;
  }

  function selectedRegion(
    manager: PixelArtCanvas,
    width = 4,
    height = 2
  ) {
    manager.mode = "uv";
    const region = manager.uv.create({ width, height });
    manager.uv.select(region.id);
    hoverCanvas(manager.canvas());

    return region;
  }

  test("R and Shift+R rotate the selected region in uv mode", () => {
    const manager = makeManager();
    const region = selectedRegion(manager);

    window.dispatchEvent(rotateKey());
    assert.deepStrictEqual(
      manager.uv.get(region.id)!.geometryFor("front"),
      { x: 0, y: 0, width: 2, height: 4, rotation: 1 }
    );

    window.dispatchEvent(rotateCounterClockwiseKey());
    assert.deepStrictEqual(
      manager.uv.get(region.id)!.geometryFor("front"),
      { x: 0, y: 0, width: 4, height: 2 }
    );
    manager.destroy();
  });

  test("R rotates only the selected slot of a free region", () => {
    const manager = makeManager();
    const region = selectedRegion(manager);
    manager.uv.setState(region.id, "free");
    manager.uv.select(region.id, "top");

    window.dispatchEvent(rotateKey());

    const stored = manager.uv.get(region.id)!;
    assert.strictEqual(stored.geometryFor("top").rotation, 1);
    assert.strictEqual(stored.geometryFor("front").rotation, undefined);
    manager.destroy();
  });

  test("rotation is ignored while a drag is in progress", () => {
    const manager = makeManager();
    const region = selectedRegion(manager);
    const canvas = manager.canvas();

    canvas.dispatchEvent(mouseEvent("mousedown", 84, 84));
    canvas.dispatchEvent(mouseEvent("mousemove", 88, 88));
    window.dispatchEvent(rotateKey());
    canvas.dispatchEvent(mouseEvent("mouseup", 88, 88));

    assert.deepStrictEqual(
      manager.uv.get(region.id)!.geometryFor("front"),
      { x: 1, y: 1, width: 4, height: 2 }
    );
    manager.destroy();
  });

  test("undo and redo a rotation", () => {
    const manager = makeManager();
    const region = selectedRegion(manager);
    manager.uv.rotate(region.id, "cw");

    manager.undo();
    assert.deepStrictEqual(manager.uv.get(region.id)!.toJSON(), region.toJSON());

    manager.redo();
    assert.strictEqual(manager.uv.get(region.id)!.geometryFor("front").rotation, 1);
    manager.destroy();
  });

  test("a region rotation broadcasts the whole region", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager({
      onBufferUpdated: (event) => events.push(event)
    });
    const region = selectedRegion(manager);
    events.length = 0;

    manager.uv.rotate(region.id, "cw");

    assert.deepStrictEqual(events, [
      {
        action: "uv-region-rotated",
        metadata: {
          id: region.id,
          face: null,
          region: manager.uv.get(region.id)!.toJSON()
        }
      }
    ]);
    manager.destroy();
  });

  test("a free slot rotation broadcasts only that slot", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager({
      onBufferUpdated: (event) => events.push(event)
    });
    const region = selectedRegion(manager);
    manager.uv.setState(region.id, "free");
    events.length = 0;

    manager.uv.rotate(region.id, "cw", "top");

    assert.deepStrictEqual(events, [
      {
        action: "uv-region-rotated",
        metadata: {
          id: region.id,
          face: "top",
          geometry: { x: 0, y: 0, width: 2, height: 4, rotation: 1 }
        }
      }
    ]);
    manager.destroy();
  });

  test("applyRemoteCommand applies a slot rotation without broadcasting or recording history", () => {
    const events: PixelBufferHookEvent[] = [];
    const manager = makeManager({
      onBufferUpdated: (event) => events.push(event)
    });
    manager.applyRemoteCommand({
      action: "uv-region-created",
      metadata: {
        region: {
          id: "remote",
          color: "#f00",
          state: "free",
          faces: {
            top: { x: 0, y: 0, width: 4, height: 2 }
          }
        }
      }
    });
    const region = manager.uv.get("remote")!;

    manager.applyRemoteCommand({
      action: "uv-region-rotated",
      metadata: {
        id: region.id,
        face: "top",
        geometry: { x: 3, y: 0, width: 2, height: 4, rotation: 1 }
      }
    });

    assert.deepStrictEqual(
      manager.uv.get(region.id)!.geometryFor("top"),
      { x: 3, y: 0, width: 2, height: 4, rotation: 1 }
    );
    assert.strictEqual(events.length, 0);
    assert.ok(!manager.canUndo());
    manager.destroy();
  });

  test("a rotated region shows its orientation marker", () => {
    const { manager, children } = createPixelArtCanvas({
      zoom: { default: 4 }
    });
    const region = selectedRegion(manager, 8, 4);

    function markers(): Element[] {
      return children.flatMap(
        (child) => [...child.querySelectorAll("[part=\"uv-orientation-marker\"]")]
      );
    }

    assert.strictEqual(markers().length, 0);

    manager.uv.rotate(region.id, "cw");

    assert.strictEqual(markers().length, 1);
    assert.strictEqual(
      markers()[0].getAttribute("points"),
      "100,95 100,105 95,100",
      "the notch sits on the right edge, where the original top now lies"
    );

    manager.uv.rotate(region.id, "ccw");
    assert.strictEqual(markers().length, 0);
    manager.destroy();
  });
});
