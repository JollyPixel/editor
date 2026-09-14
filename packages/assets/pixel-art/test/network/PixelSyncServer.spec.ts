// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MessageParser } from "@jolly-pixel/network";
import { PixelBuffer } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { PixelSyncServer } from "#src/network/PixelSyncServer.ts";
import {
  command,
  freeRegion,
  gray,
  stackedRegion
} from "../fixtures/commands.ts";
import { createRoomContext } from "../helpers/roomContext.ts";

function makeServer(): PixelSyncServer {
  return new PixelSyncServer({
    buffer: new PixelBuffer({ size: { x: 4, y: 4 } })
  });
}

describe("PixelSyncServer", () => {
  test("sends the current snapshot to a connecting client", () => {
    const server = makeServer();
    const received: unknown[] = [];

    server.onClientConnect({
      id: "A",
      send: (data) => received.push(data)
    });

    assert.deepStrictEqual(received, [{ type: "snapshot", data: server.snapshot() }]);
  });

  test("applies and broadcasts an accepted command", () => {
    const server = makeServer();
    const { context, broadcasts } = createRoomContext();
    const stroke = command("stroke", {
      color: gray(7),
      positions: [{ x: 2, y: 0 }]
    });

    server.receive(stroke, context);

    assert.deepStrictEqual(server.buffer.samplePixel(2, 0), [7, 7, 7, 255]);
    assert.deepStrictEqual(broadcasts, [{ type: "command", data: stroke }]);
  });

  test("applies and broadcasts only the positions the arbiter accepted", () => {
    const server = makeServer();
    const { context, broadcasts } = createRoomContext();
    server.receive(command("stroke", {
      color: gray(9),
      positions: [{ x: 0, y: 0 }]
    }, { clientId: "A", timestamp: 900 }), context);
    broadcasts.length = 0;

    server.receive(command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 0 }, { x: 1, y: 1 }]
    }, { clientId: "B", timestamp: 500 }), context);

    assert.deepStrictEqual(server.buffer.samplePixel(0, 0), [9, 9, 9, 255]);
    assert.deepStrictEqual(server.buffer.samplePixel(1, 1), [1, 1, 1, 255]);
    assert.deepStrictEqual(broadcasts, [{
      type: "command",
      data: command("stroke", {
        color: gray(1),
        positions: [{ x: 1, y: 1 }]
      }, { clientId: "B", timestamp: 500 })
    }]);
  });

  test("neither applies nor broadcasts a rejected command", () => {
    const server = makeServer();
    const { context, broadcasts } = createRoomContext();
    const positions = [{ x: 0, y: 0 }];
    server.receive(command("stroke", { color: gray(9), positions }, {
      clientId: "A",
      timestamp: 900
    }), context);
    broadcasts.length = 0;

    server.receive(command("select-edit", { positions, colors: [gray(1)] }, {
      clientId: "B",
      timestamp: 500
    }), context);

    assert.deepStrictEqual(server.buffer.samplePixel(0, 0), [9, 9, 9, 255]);
    assert.deepStrictEqual(broadcasts, []);
  });

  test("applies and broadcasts structural commands", () => {
    const server = makeServer();
    const { context, broadcasts } = createRoomContext();

    server.receive(command("resized", { size: { x: 8, y: 2 } }), context);
    server.receive(command("texture-replaced", { size: { x: 2, y: 2 }, pixels: "" }), context);
    server.receive(command("uv-region-state-changed", { region: freeRegion("r1") }), context);

    assert.deepStrictEqual(server.buffer.size(), { x: 2, y: 2 });
    assert.strictEqual(server.buffer.uvRegions.get("r1")?.state, "free");
    assert.strictEqual(broadcasts.length, 3);
  });

  test("snapshots the buffer pixels and UV regions", () => {
    const server = new PixelSyncServer({
      buffer: new PixelBuffer({ size: { x: 2, y: 2 } })
    });
    const { context } = createRoomContext();
    const region = {
      ...stackedRegion("r1"),
      name: "Grass block"
    };
    server.receive(command("stroke", {
      color: { r: 5, g: 6, b: 7, a: 255 },
      positions: [{ x: 0, y: 0 }]
    }), context);
    server.receive(command("uv-region-created", { region }), context);

    const snapshot = server.snapshot();

    assert.deepStrictEqual(snapshot.size, { x: 2, y: 2 });
    assert.deepStrictEqual([...Buffer.from(snapshot.pixels, "base64").subarray(0, 4)], [5, 6, 7, 255]);
    assert.deepStrictEqual(snapshot.uvRegions, [region]);
  });

  test("keeps a buffer passed through options", () => {
    const buffer = new PixelBuffer({ size: { x: 4, y: 4 } });

    assert.strictEqual(new PixelSyncServer({ buffer }).buffer, buffer);
  });

  test("defaults to the \"pixel-draw\" id, overridable per instance", () => {
    assert.strictEqual(new PixelSyncServer().id, "pixel-draw");
    assert.strictEqual(new PixelSyncServer({ id: "pixel-draw:tex1" }).id, "pixel-draw:tex1");
  });
});

describe("PixelSyncServer — incoming messages", () => {
  test("stamps commands with the connection id instead of the claimed client id", () => {
    const server = makeServer();
    const { context, broadcasts } = createRoomContext();
    const stroke = command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 0 }]
    }, { clientId: "spoofed" });

    server.onMessage("connection-A", stroke, context);

    assert.deepStrictEqual(broadcasts, [{
      type: "command",
      data: { ...stroke, clientId: "connection-A" }
    }]);
  });

  test("drops malformed command metadata", () => {
    const server = makeServer();
    const { context, broadcasts } = createRoomContext();

    server.onMessage("connection-A", command("select-edit", {
      positions: [{ x: 0, y: 0 }],
      colors: []
    }), context);

    assert.deepStrictEqual(broadcasts, []);
    assert.deepStrictEqual(server.buffer.samplePixel(0, 0), [255, 255, 255, 255]);
  });

  test("the inbound protocol rejects an invalid header", () => {
    const parser = new MessageParser(makeServer().protocols.inbound!);
    const stroke = command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 0 }]
    });

    assert.strictEqual(parser.parse({ ...stroke, timestamp: Number.NaN }).ok, false);
    assert.strictEqual(parser.parse({ ...stroke, seq: -1 }).ok, false);
    assert.strictEqual(parser.parse({ ...stroke, clientId: 42 }).ok, false);
    assert.strictEqual(parser.parse({ unexpected: true }).ok, false);
  });

  test("the inbound protocol exposes command actions for rights lookup", () => {
    const parser = new MessageParser(makeServer().protocols.inbound!);
    const parsed = parser.parse(command("stroke", {
      color: gray(1),
      positions: [{ x: 0, y: 0 }]
    }));

    assert.ok(parser.events.includes("stroke"));
    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.val.event, "stroke");
  });
});
