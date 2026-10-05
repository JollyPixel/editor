// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { MessageParser, SchemaParser } from "@jolly-pixel/network";
import {
  ColorPalette,
  PixelBuffer,
  PixelDocumentState,
  PixelDocument,
  pixelArtSnapshot
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
import { unpackPixelCommand } from "#src/network/PixelWireCodec.ts";
import { PixelSyncClient } from "#src/network/PixelSyncClient.ts";
import { command } from "../fixtures/commands.ts";
import { MockRoom } from "../helpers/room.ts";

// CONSTANTS
const kColor = { r: 12, g: 34, b: 56, a: 128 };
const kOtherColor = { r: 200, g: 100, b: 50, a: 255 };

function stateOf(): PixelDocumentState {
  return new PixelDocumentState({
    buffer: new PixelBuffer({ size: { x: 1, y: 1 } })
  });
}

describe("palette network commands", () => {
  test("the protocol validates slot indices, channel bytes and snapshot length", () => {
    const parser = new MessageParser(pixelCommandProtocol);
    assert.equal(parser.parse(command("palette-color-changed", {
      index: 9, color: kColor
    })).ok, true);
    for (const index of [-1, 10, 0.5]) {
      assert.equal(parser.parse(command("palette-color-changed", {
        index, color: kColor
      })).ok, false);
    }
    for (const a of [-1, 256, 0.5]) {
      assert.equal(parser.parse(command("palette-color-changed", {
        index: 0, color: { ...kColor, a }
      })).ok, false);
    }
    const snapshots = new SchemaParser(pixelSnapshotSchema);
    const snapshot = pixelArtSnapshot(stateOf());
    assert.equal(snapshots.parse(snapshot).ok, true);
    assert.equal(snapshots.parse({ ...snapshot, palette: [] }).ok, false);
    delete snapshot.palette;
    assert.equal(snapshots.parse(snapshot).ok, true);
  });

  test("different slots survive while stale same-slot replays lose after restart", () => {
    const state = stateOf();
    const newer = command("palette-color-changed", {
      index: 3, color: kColor
    }, { clientId: "B", timestamp: 900 });
    for (const replay of [false, true]) {
      const arbiter = new PixelCommandArbiter();
      if (replay) {
        arbiter.restore(newer, 1);
      }
      else {
        const admission = arbiter.admit(state, newer);
        assert.ok(admission);
        applyPixelCommand(state, admission.command);
        admission.commit(1);
      }
      assert.equal(arbiter.admit(state, command("palette-color-changed", {
        index: 3, color: kOtherColor
      }, { clientId: "A", timestamp: 500, basis: 0 })), null);
      const other = arbiter.admit(state, command("palette-color-changed", {
        index: 4, color: kOtherColor
      }, { clientId: "A", timestamp: 500, basis: 0 }));
      assert.ok(other);
      applyPixelCommand(state, other.command);
      assert.deepEqual(state.palette.colorAt(3), kColor);
      assert.deepEqual(state.palette.colorAt(4), kOtherColor);
    }
  });

  test("pending edits on one slot do not hide a peer's winning edit on another", () => {
    const local = new PixelDocument({ size: { x: 1, y: 1 } });
    const peer = new PixelDocument({ size: { x: 1, y: 1 } });
    const room = new MockRoom({ clientId: "A" });
    const sync = new PixelSyncClient({ room, document: local });
    room.deliverSnapshot(pixelArtSnapshot(stateOf()));
    local.changePaletteColor(2, kColor);
    const pending = room.sent[0];
    peer.applyRemoteCommand(unpackPixelCommand(pending));
    const other = command("palette-color-changed", {
      index: 7, color: kOtherColor
    }, { clientId: "B", timestamp: pending.timestamp + 1 });
    peer.applyRemoteCommand(other);
    room.deliverCommand(other);
    assert.deepEqual(local.palette.toJSON(), peer.palette.toJSON());

    const winner = command("palette-color-changed", {
      index: 2, color: kOtherColor
    }, { clientId: "B", timestamp: pending.timestamp + 2 });
    peer.applyRemoteCommand(winner);
    room.deliverCommand(winner);
    assert.deepEqual(local.palette.toJSON(), peer.palette.toJSON());
    sync.destroy();
  });

  test("base64 and PNG reconnect snapshots carry palette alpha and reset legacy state", async() => {
    const state = stateOf();
    applyPixelCommand(state, command("palette-color-changed", {
      index: 9, color: kColor
    }));
    const doc = new PixelDocument({ size: { x: 1, y: 1 } });
    for (const snapshot of [pixelArtSnapshot(state), await encodePixelSnapshot(state)]) {
      await loadPixelSnapshot(doc, snapshot);
      assert.deepEqual(doc.palette.colorAt(9), kColor);
      delete snapshot.palette;
      await loadPixelSnapshot(doc, snapshot);
      assert.deepEqual(doc.palette.toJSON(), ColorPalette.create().toJSON());
    }
  });
});
