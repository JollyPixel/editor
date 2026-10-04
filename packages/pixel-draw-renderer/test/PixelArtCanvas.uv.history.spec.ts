// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { PixelBufferHookEvent } from "#src/buffer/hooks.ts";
import { createUvCanvas } from "./helpers/uv/canvas.ts";

describe("PixelArtCanvas — uv mode", () => {
  describe("history", () => {
    test("undo/redo a create", () => {
      const manager = createUvCanvas();
      const region = manager.uv.create({
        width: 4,
        height: 4
      });

      assert.ok(manager.canUndo());
      manager.undo();
      assert.strictEqual(
        manager.uv.get(region.id),
        undefined
      );
      assert.ok(!manager.canUndo());
      assert.ok(manager.canRedo());

      manager.redo();
      assert.deepStrictEqual(
        manager.uv.get(region.id),
        region
      );
    });

    test("undo/redo a delete", () => {
      const manager = createUvCanvas();
      const region = manager.uv.create({
        width: 4,
        height: 4
      });
      manager.uv.delete(region.id);

      manager.undo();
      assert.deepStrictEqual(
        manager.uv.get(region.id),
        region
      );

      manager.redo();
      assert.strictEqual(
        manager.uv.get(region.id),
        undefined
      );
    });

    test("undo/redo a move", () => {
      const manager = createUvCanvas();
      const region = manager.uv.create({
        width: 4,
        height: 4
      });
      manager.uv.move(
        region.id,
        { x: 3, y: 3, width: 4, height: 4 }
      );

      manager.undo();
      assert.deepStrictEqual(
        manager.uv.get(region.id)!.rectFor("front"),
        region.rectFor("front")
      );

      manager.redo();
      assert.deepStrictEqual(
        manager.uv.get(region.id)!.rectFor("front"),
        { x: 3, y: 3, width: 4, height: 4 }
      );
    });

    test("undo/redo an free", () => {
      const manager = createUvCanvas();
      const region = manager.uv.create({ width: 4, height: 4 });
      manager.uv.setState(region.id, "free");

      manager.undo();
      assert.strictEqual(manager.uv.get(region.id)!.state, "stacked");

      manager.redo();
      assert.strictEqual(manager.uv.get(region.id)!.state, "free");
    });

    test("undoing a stack restores the previous face layout", () => {
      const manager = createUvCanvas();
      const region = manager.uv.create({ width: 4, height: 4 });
      manager.uv.setState(region.id, "free");
      manager.uv.move(region.id, { x: 3, y: 3, width: 4, height: 4 }, "top");
      manager.uv.setState(region.id, "stacked");
      assert.strictEqual(manager.uv.get(region.id)!.state, "stacked");

      manager.undo();

      const restored = manager.uv.get(region.id)!;
      assert.strictEqual(restored.state, "free");
      assert.deepStrictEqual(
        restored.rectFor("top"),
        { x: 3, y: 3, width: 4, height: 4 },
        "stack is lossy, so undo must replay the whole previous region"
      );
    });

    test("undoing a stack does not look like a region being recreated", () => {
      const manager = createUvCanvas();
      const region = manager.uv.create({ width: 4, height: 4 });
      manager.uv.setState(region.id, "free");
      manager.uv.setState(region.id, "stacked");

      const created: string[] = [];
      const deleted: string[] = [];
      manager.uv.on("region-created", (e) => created.push(e.region.id));
      manager.uv.on("region-deleted", (e) => deleted.push(e.region.id));

      manager.undo();

      assert.deepStrictEqual(created, [], "a consumer would spawn a duplicate mesh");
      assert.deepStrictEqual(deleted, []);
    });
  });

  describe("network hook", () => {
    test("create/move/delete each emit exactly one hook event of the matching action", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = createUvCanvas({
        onBufferUpdated: (e) => events.push(e)
      });

      const region = manager.uv.create({
        width: 4,
        height: 4
      });
      manager.uv.move(
        region.id,
        { x: 1, y: 1, width: 4, height: 4 }
      );
      manager.uv.delete(region.id);

      assert.deepStrictEqual(events.map((e) => e.action), [
        "uv-region-created",
        "uv-region-moved",
        "uv-region-deleted"
      ]);
    });

    test("undo of a move broadcasts the inverse uv-region-moved event", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = createUvCanvas({
        onBufferUpdated: (e) => events.push(e)
      });

      const region = manager.uv.create({
        width: 4,
        height: 4
      });
      manager.uv.move(
        region.id,
        { x: 5, y: 5, width: 4, height: 4 }
      );
      events.length = 0;

      manager.undo();

      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0].action, "uv-region-moved");
      if (events[0].action === "uv-region-moved") {
        assert.deepStrictEqual(
          events[0].metadata.rect,
          region.rectFor("front")
        );
      }
    });

    test("applyRemoteCommand restores a remote region without re-broadcasting or recording history", () => {
      const events: PixelBufferHookEvent[] = [];
      const manager = createUvCanvas({
        onBufferUpdated: (e) => events.push(e)
      });

      manager.applyRemoteCommand({
        action: "uv-region-created",
        metadata: {
          region: {
            state: "stacked",
            id: "remote-1",
            rect: { x: 0, y: 0, width: 4, height: 4 },
            color: "#f00"
          }
        }
      });

      assert.ok(manager.uv.get("remote-1"));
      assert.strictEqual(events.length, 0, "remote application must not re-broadcast");
      assert.ok(!manager.canUndo(), "remote application must not record local history");
    });
  });
});
