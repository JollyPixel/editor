// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PixelCommandArbiter
} from "#src/network/PixelCommandArbiter.ts";
import { PixelBuffer } from "#src/buffer/PixelBuffer.ts";
import type { PixelNetworkCommand } from "#src/network/types.ts";

function strokeCmd(
  opts: {
    clientId?: string;
    seq?: number;
    timestamp?: number;
    positions?: { x: number; y: number; }[];
  } = {}
): PixelNetworkCommand {
  return {
    action: "stroke",
    metadata: {
      color: {
        r: 1,
        g: 2,
        b: 3,
        a: 255
      },
      positions: opts.positions ?? [{ x: 0, y: 0 }]
    },
    clientId: opts.clientId ?? "client-A",
    seq: opts.seq ?? 1,
    timestamp: opts.timestamp ?? 1000
  };
}

function resizedCmd(
  size: { x: number; y: number; }
): PixelNetworkCommand {
  return {
    action: "resized",
    metadata: { size },
    clientId: "client-A",
    seq: 1,
    timestamp: 1000
  };
}

describe("PixelCommandArbiter", () => {
  test("accepts an uncontested stroke unchanged", () => {
    const arbiter = new PixelCommandArbiter();
    const buffer = new PixelBuffer({ size: { x: 4, y: 4 } });
    const command = strokeCmd({ positions: [{ x: 1, y: 1 }] });

    assert.deepEqual(arbiter.accept(buffer, command), command);
  });

  test("narrows a stroke to the positions that won", () => {
    const arbiter = new PixelCommandArbiter();
    const buffer = new PixelBuffer({ size: { x: 4, y: 4 } });

    arbiter.accept(buffer, strokeCmd({
      clientId: "late",
      timestamp: 2000,
      positions: [{ x: 0, y: 0 }]
    }));
    const accepted = arbiter.accept(buffer, strokeCmd({
      clientId: "early",
      timestamp: 1000,
      positions: [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ]
    }));

    assert.notStrictEqual(accepted, null);
    assert.deepEqual(
      accepted!.action === "stroke" ? accepted!.metadata.positions : null,
      [{ x: 1, y: 1 }]
    );
  });

  test("returns null when every position lost", () => {
    const arbiter = new PixelCommandArbiter();
    const buffer = new PixelBuffer({ size: { x: 4, y: 4 } });

    arbiter.accept(buffer, strokeCmd({
      clientId: "late",
      timestamp: 2000
    }));

    assert.strictEqual(
      arbiter.accept(buffer, strokeCmd({
        clientId: "early",
        timestamp: 1000
      })),
      null
    );
  });

  test("leaves the buffer untouched", () => {
    const arbiter = new PixelCommandArbiter();
    const buffer = new PixelBuffer({ size: { x: 2, y: 2 } });
    const before = Uint8ClampedArray.from(buffer.pixels());

    arbiter.accept(buffer, strokeCmd({ positions: [{ x: 0, y: 0 }] }));

    assert.deepEqual(buffer.pixels(), before);
  });

  test("rejects a size the buffer would refuse", () => {
    const arbiter = new PixelCommandArbiter();
    const buffer = new PixelBuffer({
      size: { x: 4, y: 4 },
      maxSize: 8
    });

    assert.strictEqual(arbiter.accept(buffer, resizedCmd({ x: 99, y: 4 })), null);
    assert.strictEqual(arbiter.accept(buffer, resizedCmd({ x: 0, y: 4 })), null);
    assert.notStrictEqual(arbiter.accept(buffer, resizedCmd({ x: 8, y: 8 })), null);
  });
});
