// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { HistoryDocument } from "./helpers/document/HistoryDocument.ts";
import type { PixelCommand } from "#src/sync/PixelCommand.ts";
import type { SavedUVNetData } from "#src/uv/region/SavedUVNet.ts";

// CONSTANTS
const kCaps: SavedUVNetData = {
  id: "caps",
  name: "Caps",
  rows: [[["top", "bottom"], ["front", "back", "left", "right"]]]
};

function netNames(
  doc: HistoryDocument
): string[] {
  return [...doc.uvNets].map((saved) => saved.name);
}

describe("Pixel Document UV nets", () => {
  test("saved, renamed, defaulted and deleted nets converge on a peer through undo and redo", () => {
    const local = new HistoryDocument({ size: { x: 1, y: 1 } });
    const peer = new HistoryDocument({ size: { x: 1, y: 1 } });
    const echoed: PixelCommand[] = [];
    peer.on("command", (command) => echoed.push(command));
    local.on("command", (command) => peer.applyRemoteCommand(command));

    local.saveUvNet(kCaps);
    local.saveUvNet({ ...kCaps, name: "Top and sides" });
    local.changeDefaultUvNet("caps");
    assert.deepEqual(netNames(peer), ["Top and sides"]);
    assert.equal(peer.uvNets.defaultId, "caps");

    local.deleteUvNet("caps");
    assert.deepEqual(netNames(peer), []);
    assert.equal(peer.uvNets.defaultId, "caps");

    local.undo();
    assert.deepEqual(netNames(peer), ["Top and sides"]);
    local.undo();
    assert.equal(peer.uvNets.defaultId, null);
    local.undo();
    assert.deepEqual(netNames(peer), ["Caps"]);
    local.undo();
    assert.deepEqual(netNames(peer), []);
    local.redo();
    assert.deepEqual(peer.uvNets.get("caps")?.net.rows, kCaps.rows);
    assert.equal(echoed.length, 0);
    assert.equal(peer.canUndo, false);
  });

  test("unchanged saves, unknown deletions and invalid nets create no history or commands", () => {
    const doc = new HistoryDocument({ size: { x: 1, y: 1 } });
    doc.saveUvNet(kCaps);
    doc.changeDefaultUvNet("caps");
    const commands: PixelCommand[] = [];
    doc.on("command", (command) => commands.push(command));

    doc.saveUvNet(structuredClone(kCaps));
    doc.changeDefaultUvNet("caps");
    doc.deleteUvNet("missing");
    for (const rows of [[], [[null]], [[["top"], ["top"]]]]) {
      assert.throws(
        () => doc.saveUvNet({ ...kCaps, rows }),
        RangeError
      );
    }
    assert.equal(commands.length, 0);
    doc.undo();
    doc.undo();
    assert.equal(doc.canUndo, false);
  });

  test("snapshot replacement loads the saved nets and clears them when absent", () => {
    const doc = new HistoryDocument({ size: { x: 1, y: 1 } });
    const changes: string[] = [];
    doc.on("uv-nets-changed", () => changes.push(doc.uvNets.defaultId ?? "none"));
    doc.saveUvNet(kCaps);

    doc.loadSnapshot({
      size: { x: 1, y: 1 },
      pixels: new Uint8ClampedArray(4),
      uvNets: {
        defaultId: "cross",
        nets: [{ ...kCaps, id: "sides" }]
      }
    });
    assert.deepEqual([...doc.uvNets].map((saved) => saved.id), ["sides"]);
    assert.equal(doc.uvNets.defaultId, "cross");

    doc.loadSnapshot({ size: { x: 1, y: 1 }, pixels: new Uint8ClampedArray(4) });
    assert.equal(doc.uvNets.isEmpty, true);
    assert.deepEqual(changes, ["none", "cross", "none"]);
  });
});
