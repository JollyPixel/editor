// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelCollaboration } from "#src/network/PixelCollaboration.ts";
import { createPixelArtCanvas } from "../helpers/canvas.ts";
import { nextFrame } from "../helpers/mock.ts";
import { MockRoom } from "../helpers/room.ts";

function setup() {
  const room = new MockRoom({ clientId: "client-A" });
  const { manager: canvas } = createPixelArtCanvas();
  const collaboration = new PixelCollaboration({
    room,
    canvas,
    color: () => "#abcdef"
  });

  return {
    room,
    canvas,
    collaboration
  };
}

describe("PixelCollaboration", () => {
  test("sends buffer edits and publishes previews on one room", async() => {
    const { room, canvas, collaboration } = setup();

    canvas.onCursorMove?.({ x: 1, y: 1 });
    canvas.onStrokeProgress?.([{ x: 1, y: 1, color: { r: 0, g: 0, b: 0, a: 255 } }]);
    canvas.onBufferUpdated?.({
      action: "resized",
      metadata: { size: { x: 4, y: 4 } }
    });
    await nextFrame();

    assert.deepStrictEqual(
      room.presenceUpdates.flatMap((patch) => Object.keys(patch)),
      ["cursor", "strokeGhost"]
    );
    assert.deepStrictEqual(room.sent.map((sent) => sent.action), ["resized"]);
    collaboration.destroy();
    canvas.destroy();
  });

  test("is ready once the first snapshot lands", () => {
    const { room, canvas, collaboration } = setup();

    assert.strictEqual(collaboration.ready, false);
    room.deliverSnapshot();

    assert.strictEqual(collaboration.ready, true);
    collaboration.destroy();
    canvas.destroy();
  });

  test("applies the color option to peer cursors", () => {
    const { room, canvas, collaboration } = setup();
    const cursors: string[] = [];
    const set = canvas.peerPresence.cursors.set.bind(canvas.peerPresence.cursors);
    canvas.peerPresence.cursors.set = (clientId, state) => {
      cursors.push(state.color);
      set(clientId, state);
    };

    room.emit("peer-presence", { clientId: "peer-B", patch: { cursor: { x: 0, y: 0 } } });

    assert.deepStrictEqual(cursors, ["#abcdef"]);
    collaboration.destroy();
    canvas.destroy();
  });

  test("destroy releases every canvas hook and room listener", () => {
    const { room, canvas, collaboration } = setup();

    collaboration.destroy();
    room.deliverSnapshot();
    canvas.onBufferUpdated?.({
      action: "resized",
      metadata: { size: { x: 4, y: 4 } }
    });

    assert.strictEqual(canvas.onStrokeProgress, undefined);
    assert.strictEqual(collaboration.ready, false);
    assert.deepStrictEqual(room.sent, []);
    canvas.destroy();
  });
});
