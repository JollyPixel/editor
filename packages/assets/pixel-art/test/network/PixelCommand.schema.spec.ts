// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MessageParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import { pixelProtocols } from "#src/network/PixelCommand.schema.ts";
import {
  command,
  gray
} from "../fixtures/commands.ts";

// CONSTANTS
const kStroke = command("stroke", {
  color: gray(1),
  positions: [{ x: 0, y: 0 }]
});

describe("pixelProtocols", () => {
  test("rejects an invalid header", () => {
    const parser = new MessageParser(pixelProtocols.inbound!);

    assert.strictEqual(parser.parse({ ...kStroke, timestamp: Number.NaN }).ok, false);
    assert.strictEqual(parser.parse({ ...kStroke, seq: -1 }).ok, false);
    assert.strictEqual(parser.parse({ ...kStroke, clientId: 42 }).ok, false);
    assert.strictEqual(parser.parse({ unexpected: true }).ok, false);
  });

  test("exposes command actions for rights lookup", () => {
    const parser = new MessageParser(pixelProtocols.inbound!);
    const parsed = parser.parse(kStroke);

    assert.ok(parser.events.includes("stroke"));
    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.val.event, "stroke");
  });
});
