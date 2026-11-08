// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { LocalHistory } from "./helpers/history/LocalHistory.ts";
import type { PixelArtCanvas } from "#src/PixelArtCanvas.ts";
import type { PixelCommand } from "#src/sync/PixelCommand.ts";
import {
  createPixelArtCanvas,
  type TestCanvasOptions
} from "./helpers/canvas.ts";

describe("PixelArtCanvas — uv mirror", () => {
  function makeManager(
    options: TestCanvasOptions = {}
  ): PixelArtCanvas {
    return createPixelArtCanvas({
      zoom: { default: 4 },
      history: new LocalHistory(),
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

    return region;
  }

  test("flip shortcuts mirror the selected region in uv mode", () => {
    const manager = makeManager();
    const region = selectedRegion(manager);

    manager.shortcuts.flipHorizontal();
    assert.deepStrictEqual(
      manager.uv.get(region.id)!.slotGeometry("front"),
      { x: 0, y: 0, width: 4, height: 2, mirrored: true }
    );

    manager.shortcuts.flipVertical();
    assert.deepStrictEqual(
      manager.uv.get(region.id)!.slotGeometry("front"),
      { x: 0, y: 0, width: 4, height: 2, rotation: 2 }
    );
    manager.destroy();
  });

  test("flip shortcuts leave regions alone when the uv tool is not mirrorable", () => {
    const manager = makeManager({
      uv: { mirrorable: false }
    });
    const region = selectedRegion(manager);

    assert.ok(!manager.shortcuts.flipHorizontal());
    assert.deepStrictEqual(manager.uv.get(region.id)!.toJSON(), region.toJSON());
    manager.destroy();
  });

  test("a region mirror broadcasts the whole region and undoes", () => {
    const events: PixelCommand[] = [];
    const manager = makeManager({
      onCommand: (event) => events.push(event)
    });
    const region = selectedRegion(manager);
    events.length = 0;

    manager.uv.mirror(region.id, "horizontal");

    assert.deepStrictEqual(events, [
      {
        action: "uv-region-mirrored",
        metadata: {
          id: region.id,
          face: null,
          region: {
            id: region.id,
            color: region.color,
            state: "stacked",
            rect: { x: 0, y: 0, width: 4, height: 2, mirrored: true }
          }
        }
      }
    ]);

    manager.undo();
    assert.deepStrictEqual(manager.uv.get(region.id)!.toJSON(), region.toJSON());

    manager.redo();
    assert.deepStrictEqual(
      manager.uv.get(region.id)!.slotGeometry("front"),
      { x: 0, y: 0, width: 4, height: 2, mirrored: true }
    );
    manager.destroy();
  });

  test("applyRemoteCommand applies a slot mirror without broadcasting or recording history", () => {
    const events: PixelCommand[] = [];
    const manager = makeManager({
      onCommand: (event) => events.push(event)
    });
    manager.document.applyRemoteCommand({
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

    manager.document.applyRemoteCommand({
      action: "uv-region-mirrored",
      metadata: {
        id: "remote",
        face: "top",
        geometry: { x: 0, y: 0, width: 4, height: 2, mirrored: true }
      }
    });

    assert.deepStrictEqual(
      manager.uv.get("remote")!.slotGeometry("top"),
      { x: 0, y: 0, width: 4, height: 2, mirrored: true }
    );
    assert.strictEqual(events.length, 0);
    assert.ok(!manager.canUndo());
    manager.destroy();
  });

  test("a mirrored region shows half of the orientation marker", () => {
    const { manager, container } = createPixelArtCanvas({
      zoom: { default: 4 }
    });
    const region = selectedRegion(manager, 8, 4);

    function markerPoints(): string | null {
      return container
        .querySelector("[part=\"uv-orientation-marker\"]")
        ?.getAttribute("points") ?? null;
    }

    manager.uv.mirror(region.id, "horizontal");
    assert.strictEqual(
      markerPoints(),
      "95,84 100,84 100,89",
      "half the notch on the top edge, toward the face's right side"
    );

    manager.uv.mirror(region.id, "horizontal");
    assert.strictEqual(markerPoints(), null);
    manager.destroy();
  });
});
