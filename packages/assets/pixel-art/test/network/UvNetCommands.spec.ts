// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MessageParser, SchemaParser } from "@jolly-pixel/network";
import {
  PixelBuffer,
  PixelDocumentState,
  PixelDocument,
  pixelArtSnapshot,
  type SavedUVNetData
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { applyPixelCommand } from "#src/network/PixelCommandApplier.ts";
import { PixelCommandArbiter } from "#src/network/PixelCommandArbiter.ts";
import {
  pixelCommandProtocol,
  pixelSnapshotSchema
} from "#src/network/PixelCommand.schema.ts";
import {
  encodePixelSnapshot,
  loadPixelSnapshot
} from "#src/network/PixelSnapshotCodec.ts";
import { command } from "../fixtures/commands.ts";

// CONSTANTS
const kCaps: SavedUVNetData = {
  id: "caps",
  name: "Caps",
  rows: [[["top", "bottom"], ["front", "back", "left", "right"]]]
};

function createState(): PixelDocumentState {
  return new PixelDocumentState({
    buffer: new PixelBuffer({ size: { x: 1, y: 1 } })
  });
}

describe("UV net network commands", () => {
  test("the protocol validates net ids and rows, and snapshots carry saved nets", () => {
    const parser = new MessageParser(pixelCommandProtocol);
    assert.equal(parser.parse(command("uv-net-saved", { net: kCaps })).ok, true);
    assert.equal(parser.parse(command("uv-net-default-changed", { id: null })).ok, true);
    for (const net of [
      { ...kCaps, id: "" },
      { ...kCaps, rows: [["top"]] },
      { ...kCaps, rows: [[[""]]] }
    ]) {
      assert.equal(parser.parse({
        ...command("uv-net-saved", { net: kCaps }),
        metadata: { net }
      }).ok, false);
    }
    assert.equal(parser.parse(command("uv-net-deleted", { id: "" })).ok, false);

    const snapshots = new SchemaParser(pixelSnapshotSchema);
    const snapshot = pixelArtSnapshot(createState());
    assert.equal(snapshots.parse({ ...snapshot, uvNets: { nets: [kCaps] } }).ok, true);
    assert.equal(snapshots.parse({ ...snapshot, uvNets: { nets: [{ id: "caps" }] } }).ok, false);
  });

  test("the arbiter refuses invalid nets and keeps concurrent edits to different nets", () => {
    const state = createState();
    const arbiter = new PixelCommandArbiter();
    assert.equal(arbiter.admit(state, command("uv-net-saved", {
      net: { ...kCaps, rows: [[["top"], ["top"]]] }
    })), null);

    const newer = arbiter.admit(state, command("uv-net-saved", {
      net: kCaps
    }, { clientId: "B", timestamp: 900 }));
    assert.ok(newer);
    applyPixelCommand(state, newer.command);
    newer.commit(1);

    assert.equal(arbiter.admit(state, command("uv-net-saved", {
      net: { ...kCaps, name: "Stale" }
    }, { clientId: "A", timestamp: 500, basis: 0 })), null);
    const other = arbiter.admit(state, command("uv-net-saved", {
      net: { ...kCaps, id: "sides", name: "Sides" }
    }, { clientId: "A", timestamp: 500, basis: 0 }));
    assert.ok(other);
    applyPixelCommand(state, other.command);
    assert.deepEqual([...state.uvNets].map((saved) => saved.name), ["Caps", "Sides"]);
  });

  test("base64 and PNG reconnect snapshots carry saved nets and clear them when absent", async() => {
    const state = createState();
    applyPixelCommand(state, command("uv-net-saved", { net: kCaps }));
    applyPixelCommand(state, command("uv-net-default-changed", { id: "caps" }));
    const doc = new PixelDocument({ size: { x: 1, y: 1 } });
    for (const snapshot of [pixelArtSnapshot(state), await encodePixelSnapshot(state)]) {
      await loadPixelSnapshot(doc, snapshot);
      assert.deepEqual(doc.uvNets.toJSON(), state.uvNets.toJSON());
      delete snapshot.uvNets;
      await loadPixelSnapshot(doc, snapshot);
      assert.equal(doc.uvNets.isEmpty, true);
    }
  });
});
