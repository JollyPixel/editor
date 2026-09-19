// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MessageParser } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  pixelCommandProtocol,
  pixelSnapshotSchema
} from "#src/network/PixelCommand.schema.ts";
import {
  command,
  gray
} from "../fixtures/commands.ts";

// CONSTANTS
const kStroke = command("stroke", {
  color: gray(1),
  positions: [{ x: 0, y: 0 }]
});
const kTile = { x: 0, y: 0, width: 16, height: 16 };
const kHeader = { clientId: "peer", seq: 0, timestamp: 1 };

function accepts(
  payload: unknown
): boolean {
  return new MessageParser(pixelCommandProtocol).parse(payload).ok;
}

function regionCreated(
  faces: unknown,
  activeFaces?: unknown
): unknown {
  return {
    ...kHeader,
    action: "uv-region-created",
    metadata: {
      region: {
        id: "block-1",
        color: "#fff",
        state: "free",
        faces,
        ...(activeFaces === undefined ? {} : { activeFaces })
      }
    }
  };
}

function regionMoved(
  face: string | null
): unknown {
  return {
    ...kHeader,
    action: "uv-region-moved",
    metadata: {
      id: "block-1",
      face,
      rect: kTile
    }
  };
}

function compound(
  parts: unknown[]
): unknown {
  return {
    shape: "compound",
    rect: kTile,
    parts
  };
}

describe("pixelCommandProtocol", () => {
  test("rejects an invalid header", () => {
    assert.strictEqual(accepts({ ...kStroke, timestamp: Number.NaN }), false);
    assert.strictEqual(accepts({ ...kStroke, seq: -1 }), false);
    assert.strictEqual(accepts({ ...kStroke, clientId: 42 }), false);
    assert.strictEqual(accepts({ unexpected: true }), false);
  });

  test("exposes command actions for rights lookup", () => {
    const parser = new MessageParser(pixelCommandProtocol);
    const parsed = parser.parse(kStroke);

    assert.ok(parser.events.includes("stroke"));
    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.val.event, "stroke");
  });

  test("rejects a stroke with a fractional position", () => {
    assert.strictEqual(accepts(command("stroke", {
      color: gray(1),
      positions: [{ x: 0.5, y: 0 }]
    })), false);
  });

  test("rejects an empty size", () => {
    assert.strictEqual(accepts(command("resized", {
      size: { x: 0, y: 4 }
    })), false);
  });
});

describe("pixelCommandProtocol: uv regions", () => {
  test("accepts a region carrying a shape's own slots", () => {
    const payload = regionCreated(
      { right: kTile, top: kTile, "top.1": kTile },
      ["right", "top", "top.1"]
    );

    assert.strictEqual(accepts(payload), true);
  });

  test("accepts a stacked region without faces", () => {
    assert.strictEqual(accepts({
      ...kHeader,
      action: "uv-region-created",
      metadata: {
        region: {
          id: "block-1",
          color: "#fff",
          state: "stacked",
          rect: kTile
        }
      }
    }), true);
  });

  test("accepts a compound geometry", () => {
    const payload = regionCreated({
      right: compound([
        { x: 0, y: 0, width: 0.5, height: 1 },
        {
          shape: "triangle",
          corner: "top-left",
          rect: { x: 0.5, y: 0, width: 0.5, height: 1 }
        }
      ])
    });

    assert.strictEqual(accepts(payload), true);
  });

  test("rejects a compound with no parts", () => {
    assert.strictEqual(accepts(regionCreated({ right: compound([]) })), false);
  });

  test("rejects a region with no slot at all", () => {
    assert.strictEqual(accepts(regionCreated({})), false);
  });

  test("rejects a slot whose geometry is not a rect", () => {
    const payload = regionCreated({
      top: { x: 0, y: 0, width: 0, height: 16 }
    });

    assert.strictEqual(accepts(payload), false);
  });

  test("rejects an empty active face list", () => {
    assert.strictEqual(accepts(regionCreated({ top: kTile }, [])), false);
  });

  test("accepts a move naming a derived slot or no slot", () => {
    assert.strictEqual(accepts(regionMoved("top.1")), true);
    assert.strictEqual(accepts(regionMoved(null)), true);
  });

  test("rejects a move naming an empty face", () => {
    assert.strictEqual(accepts(regionMoved("")), false);
  });
});

describe("pixelSnapshotSchema", () => {
  test("validates the snapshot's uv regions", () => {
    const parser = new MessageParser({
      schema: {
        title: "snapshot",
        ...pixelSnapshotSchema
      }
    });
    const snapshot = {
      size: { x: 4, y: 4 },
      pixels: ""
    };

    assert.strictEqual(parser.parse(snapshot).ok, true);
    assert.strictEqual(parser.parse({
      ...snapshot,
      uvRegions: [{ id: "", color: "#fff", state: "free" }]
    }).ok, false);
  });
});

describe("pixelCommandProtocol — uv rotation", () => {
  function regionRotated(
    metadata: unknown
  ): unknown {
    return {
      ...kHeader,
      action: "uv-region-rotated",
      metadata
    };
  }

  test("accepts a slot rotation carrying the rotated geometry", () => {
    assert.ok(accepts(regionRotated({
      id: "block-1",
      face: "top",
      geometry: { ...kTile, rotation: 1 }
    })));
    assert.ok(accepts(regionRotated({
      id: "block-1",
      face: "left",
      geometry: {
        shape: "triangle",
        corner: "bottom-left",
        rect: kTile,
        rotation: 3
      }
    })));
  });

  test("accepts a region rotation carrying a stacked rect rotation", () => {
    assert.ok(accepts(regionRotated({
      id: "block-1",
      face: null,
      region: {
        id: "block-1",
        color: "#fff",
        state: "stacked",
        rect: { ...kTile, rotation: 2 }
      }
    })));
  });

  test("rejects rotations other than quarter turns", () => {
    assert.strictEqual(accepts(regionRotated({
      id: "block-1",
      face: "top",
      geometry: { ...kTile, rotation: 4 }
    })), false);
    assert.strictEqual(
      accepts(regionCreated({ top: { ...kTile, rotation: 0.5 } })),
      false
    );
  });

  test("rejects a region rotation without its region", () => {
    assert.strictEqual(accepts(regionRotated({
      id: "block-1",
      face: null,
      geometry: kTile
    })), false);
  });
});
