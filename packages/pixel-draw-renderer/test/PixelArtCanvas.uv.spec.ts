// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createUvCanvas } from "./helpers/uv/canvas.ts";
import { mouseEvent } from "./helpers/events.ts";

describe("PixelArtCanvas — uv mode", () => {
  test("selecting a region makes it draggable in uv mode", () => {
    const manager = createUvCanvas();
    manager.mode = "uv";
    const region = manager.uv.create({
      width: 4,
      height: 4
    });
    manager.uv.select(region.id);

    const canvas = manager.canvas();
    canvas.dispatchEvent(mouseEvent("mousedown", 84, 84));
    canvas.dispatchEvent(mouseEvent("mousemove", 92, 92));
    canvas.dispatchEvent(mouseEvent("mouseup", 92, 92));

    assert.deepStrictEqual(
      manager.uv.get(region.id)!.rectFor("front"),
      { x: 2, y: 2, width: 4, height: 4 }
    );
  });

  test("Delete removes the selected region while in uv mode", () => {
    const manager = createUvCanvas();
    manager.mode = "uv";
    const region = manager.uv.create({
      width: 4,
      height: 4
    });
    manager.uv.select(region.id);

    manager.shortcuts.delete();

    assert.strictEqual(
      manager.uv.get(region.id),
      undefined
    );
  });

  test("Delete in select mode commits a pixel edit and leaves the UV region in place", () => {
    const manager = createUvCanvas();
    const region = manager.uv.create({
      width: 4,
      height: 4
    });
    manager.uv.select(region.id);

    manager.mode = "select";
    const canvas = manager.canvas();
    canvas.dispatchEvent(mouseEvent("mousedown", 92, 92));
    canvas.dispatchEvent(mouseEvent("mousemove", 96, 96));
    canvas.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true })
    );

    manager.shortcuts.delete();

    assert.ok(
      manager.canUndo(),
      "the select-mode delete should have committed an edit"
    );
    assert.ok(
      manager.uv.get(region.id),
      "the UV region must survive a Delete outside uv mode"
    );
  });

  test("leaving uv mode cancels an in-progress drag without moving the region", () => {
    const manager = createUvCanvas();
    manager.mode = "uv";
    const region = manager.uv.create({
      width: 4,
      height: 4
    });
    manager.uv.select(region.id);

    const canvas = manager.canvas();
    canvas.dispatchEvent(mouseEvent("mousedown", 84, 84));
    canvas.dispatchEvent(mouseEvent("mousemove", 92, 92));
    manager.mode = "paint";
    canvas.dispatchEvent(mouseEvent("mouseup", 92, 92));

    assert.deepStrictEqual(
      manager.uv.get(region.id)!.rectFor("front"),
      region.rectFor("front")
    );
  });

  for (const { name, deselectOnEmptyClick, keepsSelection } of [
    {
      name: "unset clears",
      deselectOnEmptyClick: undefined,
      keepsSelection: false
    },
    {
      name: "false keeps",
      deselectOnEmptyClick: false,
      keepsSelection: true
    }
  ]) {
    test(`uv.deselectOnEmptyClick ${name} the selection on an outside click`, () => {
      const manager = createUvCanvas({
        uv: { deselectOnEmptyClick }
      });
      manager.mode = "uv";
      const region = manager.uv.create({
        width: 4,
        height: 4
      });
      manager.uv.select(region.id);

      const canvas = manager.canvas();
      canvas.dispatchEvent(mouseEvent("mousedown", 160, 160));
      canvas.dispatchEvent(mouseEvent("mouseup", 160, 160));

      assert.strictEqual(
        manager.uv.selectedRegionId,
        keepsSelection ? region.id : null
      );
      assert.strictEqual(
        manager.uv.isVisible(region.id),
        keepsSelection
      );
    });
  }

  test("leaving uv mode does not clear the current selection/visibility", () => {
    const manager = createUvCanvas();
    const region = manager.uv.create({
      width: 4,
      height: 4
    });
    manager.mode = "uv";
    manager.uv.select(region.id);

    manager.mode = "paint";

    assert.strictEqual(
      manager.uv.selectedRegionId,
      region.id
    );
    assert.ok(manager.uv.isVisible(region.id));
  });

  describe("cursor", () => {
    test("entering uv mode sets a grab cursor; leaving it resets to default", () => {
      const manager = createUvCanvas();
      const canvas = manager.canvas();

      manager.mode = "uv";
      assert.strictEqual(canvas.style.cursor, "grab");

      manager.mode = "paint";
      assert.strictEqual(canvas.style.cursor, "");
    });

    test("dragging a region switches the cursor to grabbing, and back to grab on release", () => {
      const manager = createUvCanvas();
      manager.mode = "uv";
      const region = manager.uv.create({
        width: 4,
        height: 4
      });
      manager.uv.select(region.id);

      const canvas = manager.canvas();
      canvas.dispatchEvent(mouseEvent("mousedown", 84, 84));
      assert.strictEqual(canvas.style.cursor, "grabbing");

      canvas.dispatchEvent(mouseEvent("mouseup", 92, 92));
      assert.strictEqual(canvas.style.cursor, "grab");
    });

    test("clicking empty space (no drag started) keeps the idle grab cursor", () => {
      const manager = createUvCanvas();
      manager.mode = "uv";

      const canvas = manager.canvas();
      canvas.dispatchEvent(
        mouseEvent("mousedown", 10, 10)
      );

      assert.strictEqual(canvas.style.cursor, "grab");
    });
  });
});
