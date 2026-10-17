// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { PixelSyncClient } from "#src/network/PixelSyncClient.ts";
import { command } from "../fixtures/commands.ts";
import { createPixelArtCanvas } from "../helpers/canvas.ts";
import { MockRoom } from "../helpers/room.ts";

describe("PixelSyncClient — UV region echoes", () => {
  function setupEcho() {
    const room: MockRoom = new MockRoom({
      onSend: (sent) => room.deliverCommand(sent)
    });
    const { manager: canvas } = createPixelArtCanvas({
      texture: { size: { x: 64, y: 64 }, maxSize: 64 },
      zoom: { default: 4 }
    });
    new PixelSyncClient({ room, document: canvas.document });
    const created: string[] = [];
    canvas.uv.on("region-created", ({ region }) => created.push(region.id));

    return {
      room,
      canvas,
      created
    };
  }

  test("creating a region broadcasts once and ignores the echo", () => {
    const { room, canvas, created } = setupEcho();

    canvas.uv.create({ id: "cube-a", width: 8, height: 8 });

    assert.deepStrictEqual(room.sent.map((sent) => sent.action), ["uv-region-created"]);
    assert.deepStrictEqual(created, ["cube-a"]);
    assert.strictEqual([...canvas.uv.regions].length, 1);
    canvas.destroy();
  });

  test("a duplicate remote create updates the known region instead of recreating it", () => {
    const { room, canvas, created } = setupEcho();
    canvas.uv.create({ id: "cube-a", width: 8, height: 8 });
    const stateChanges: string[] = [];
    canvas.uv.on("region-state-changed", ({ region }) => stateChanges.push(region.id));

    room.deliverCommand({ ...room.sent[0], clientId: "other-client" });

    assert.deepStrictEqual(created, ["cube-a"]);
    assert.deepStrictEqual(stateChanges, ["cube-a"]);
    assert.strictEqual([...canvas.uv.regions].length, 1);
    canvas.destroy();
  });

  test("a new remote region is created", () => {
    const { room, canvas, created } = setupEcho();
    canvas.uv.create({ id: "cube-a", width: 8, height: 8 });
    const [sent] = room.sent;
    assert.strictEqual(sent.action, "uv-region-created");

    room.deliverCommand(command("uv-region-created", {
      region: { ...sent.metadata.region, id: "cube-b" }
    }, { clientId: "other-client" }));

    assert.deepStrictEqual(created, ["cube-a", "cube-b"]);
    assert.strictEqual([...canvas.uv.regions].length, 2);
    canvas.destroy();
  });
});
