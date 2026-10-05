// Import Node.js Dependencies
import { test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelSyncClient } from "#src/network/PixelSyncClient.ts";
import { UVGhostSync } from "#src/network/ghosts/UVGhostSync.ts";
import { createPixelArtCanvas } from "../../helpers/canvas.ts";
import { mouseEvent } from "../../helpers/events.ts";
import { nextFrame } from "../../helpers/mock.ts";
import { MockRoom } from "../../helpers/room.ts";

for (const ending of ["cancel", "commit", "disconnect"] as const) {
  test(`peer UV resize stays blocked until ${ending}`, async(t) => {
    const roomA = new MockRoom({ clientId: "A" });
    const roomB = new MockRoom({ clientId: "B" });
    const options = {
      zoom: { default: 4 },
      uv: { resizable: true }
    };
    const first = createPixelArtCanvas(options);
    const second = createPixelArtCanvas(options);
    const syncA = new UVGhostSync({
      room: roomA,
      canvas: first.manager,
      color: () => "#ff0000"
    });
    const syncB = new UVGhostSync({
      room: roomB,
      canvas: second.manager,
      color: () => "#00ff00"
    });
    t.after(() => {
      syncA.destroy();
      syncB.destroy();
      first.manager.destroy();
      second.manager.destroy();
    });
    first.manager.mode = "uv";
    second.manager.mode = "uv";
    const region = first.manager.uv.create({ width: 4, height: 4 });
    first.manager.uv.setState(region.id, "free");
    const before = first.manager.uv.get(region.id)!;
    second.manager.uv.restore(before.toJSON());
    const commandsA = new PixelSyncClient({
      room: roomA,
      document: first.manager.document
    });
    const commandsB = new PixelSyncClient({
      room: roomB,
      document: second.manager.document
    });
    t.after(() => {
      commandsA.destroy();
      commandsB.destroy();
    });
    first.manager.uv.select(region.id, "front");
    second.manager.uv.select(region.id, "front");

    function deliverPresence(): void {
      for (const patch of roomA.presenceUpdates.splice(0)) {
        roomB.emit("peer-presence", { clientId: "A", patch });
      }
    }

    function handles(): SVGRectElement[] {
      return second.children.flatMap((child) => [
        ...child.querySelectorAll<SVGRectElement>(
          "[part='uv-resize-handle']"
        )
      ]);
    }

    assert.equal(handles().length, 4);
    first.canvas.dispatchEvent(mouseEvent("mousedown", 100, 100));
    await nextFrame();
    deliverPresence();
    assert.equal(handles().length, 0);

    first.canvas.dispatchEvent(mouseEvent("mousemove", 108, 104));
    await nextFrame();
    deliverPresence();
    second.canvas.dispatchEvent(mouseEvent("mousedown", 99, 99));
    second.canvas.dispatchEvent(mouseEvent("mousemove", 104, 104));
    second.canvas.dispatchEvent(mouseEvent("mouseup", 104, 104));
    assert.deepEqual(second.manager.uv.get(region.id)!.toJSON(), before.toJSON());

    if (ending === "disconnect") {
      roomB.emit("peer-left", { clientId: "A" });
    }
    else if (ending === "cancel") {
      first.manager.mode = "paint";
      deliverPresence();
    }
    else {
      first.canvas.dispatchEvent(mouseEvent("mouseup", 108, 104));
      assert.equal(roomA.sent.length, 1);
      for (const command of roomA.sent) {
        roomB.deliverCommand(command);
      }
      assert.deepEqual(
        second.manager.uv.get(region.id)!.toJSON(),
        first.manager.uv.get(region.id)!.toJSON()
      );
      deliverPresence();
      assert.equal(second.manager.uv.get(region.id)!.rectFor("front").width, 6);
      assert.deepEqual(
        handles().map((handle) => handle.getAttribute("x")),
        ["80.5", "104.5", "80.5", "104.5"]
      );
    }
    assert.equal(handles().length, 4);
  });
}
