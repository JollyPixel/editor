// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PeerMetadata } from "@jolly-pixel/network";
import { SelectionPresence, type SelectionPresenceData } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { StandalonePixelHistory } from "#src/history/PixelCanvasHistory.ts";
import { SelectionGhostSync } from "#src/network/presence/SelectionGhostSync.ts";
import {
  decodeSelectionPresence,
  encodeSelectionPresence
} from "#src/network/presence/SelectionPresenceCodec.ts";
import { createPixelArtCanvas, type CreatedPixelArtCanvas } from "../../helpers/canvas.ts";
import { mouseEvent } from "../../helpers/events.ts";
import { MockRoom } from "../../helpers/room.ts";
import { gray } from "../../fixtures/commands.ts";

class SelectionRoom extends MockRoom {
  target: MockRoom | undefined;
  presence: PeerMetadata = {};

  override updatePresence(
    patch: PeerMetadata
  ): void {
    super.updatePresence(patch);
    this.presence = { ...this.presence, ...patch };
    if (this.target !== undefined) {
      this.target.addPeer(this.clientId, { presence: this.presence });
      this.target.emit("peer-presence", { clientId: this.clientId, patch });
    }
  }
}

function setup(
  t: TestContext
) {
  const owner = createPixelArtCanvas({
    zoom: { default: 4, smoothing: 0 },
    history: new StandalonePixelHistory(),
    clipboard: null,
    select: { eraseColor: "#FF00FF" }
  });
  const peer = createPixelArtCanvas({ zoom: { default: 4, smoothing: 0 } });
  const ownerRoom = new SelectionRoom({ clientId: "owner" });
  const peerRoom = new MockRoom({ clientId: "peer" });
  ownerRoom.target = peerRoom;
  const peerSync = new SelectionGhostSync({
    room: peerRoom,
    canvas: peer.manager,
    color: () => "#123456"
  });
  const ownerSync = new SelectionGhostSync({
    room: ownerRoom,
    canvas: owner.manager,
    color: () => "#123456"
  });
  let seq = 0;
  owner.manager.document.on("command", (edit) => {
    peer.manager.document.applyRemoteCommand(edit);
    peerRoom.deliverCommand({
      ...edit,
      clientId: "owner",
      seq: ++seq,
      timestamp: seq
    });
  });
  t.after(() => {
    ownerSync.destroy();
    peerSync.destroy();
    owner.manager.destroy();
    peer.manager.destroy();
  });

  return { owner, peer, ownerRoom, peerRoom, ownerSync };
}

function drag(
  canvas: HTMLCanvasElement,
  from: [number, number],
  to: [number, number]
): void {
  canvas.dispatchEvent(mouseEvent("mousedown", ...from));
  canvas.dispatchEvent(mouseEvent("mousemove", ...to));
  canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
}

function selectPair(
  owner: CreatedPixelArtCanvas
): void {
  owner.manager.brush.primary.set("#000000");
  owner.manager.commitPixels([{ x: 2, y: 2 }]);
  owner.manager.brush.primary.set("#FF0000");
  owner.manager.commitPixels([{ x: 3, y: 2 }]);
  owner.manager.mode = "select";
  drag(owner.canvas, [92, 92], [96, 92]);
}

function readPath(
  canvas: CreatedPixelArtCanvas,
  selector: string
): string | null | undefined {
  const svg = canvas.children.find((child) => child.tagName.toLowerCase() === "svg");

  return svg?.querySelector(selector)?.getAttribute("d");
}

function assertSelection(
  owner: CreatedPixelArtCanvas,
  peer: CreatedPixelArtCanvas
): void {
  assert.equal(peer.manager.peerPresence.selectionOutlines.isActive, true);
  assert.equal(
    readPath(peer, "[data-layer=peer-selections] path"),
    readPath(owner, "[data-overlay=selection]")
  );
}

describe("SelectionGhostSync wire validation", () => {
  test("packed masks and RGBA preserve exact bytes", () => {
    const data: SelectionPresenceData = {
      phase: "floating",
      sourceRect: { x: -2, y: 0, width: 3, height: 1 },
      liveRect: { x: -2, y: 0, width: 3, height: 1 },
      pixels: [
        { r: 10, g: 20, b: 30, a: 0 },
        { r: 40, g: 50, b: 60, a: 128 },
        { r: 70, g: 80, b: 90, a: 255 }
      ],
      mask: [true, false, true],
      eraseColor: { r: 9, g: 8, b: 7, a: 0 },
      blankSource: false
    };
    assert.deepEqual(decodeSelectionPresence(encodeSelectionPresence(data), 1024), data);
    assert.deepEqual(SelectionPresence.parse(data)?.toJSON(), data);
  });

  test("invalid and oversized payloads clear an existing peer selection", (t) => {
    const { owner, peer, peerRoom, ownerRoom } = setup(t);
    selectPair(owner);
    const validPreview = encodeSelectionPresence({
      phase: "moving",
      sourceRect: { x: 0, y: 0, width: 2, height: 1 },
      liveRect: { x: 2, y: 2, width: 2, height: 1 },
      mask: [true, true],
      pixels: [gray(0), gray(255)],
      eraseColor: gray(0),
      blankSource: true
    });
    assert.ok(validPreview !== null && "sourceRect" in validPreview);
    const malformed = [
      { ...validPreview, pixels: "AA==" },
      { ...validPreview, eraseColor: { r: 256, g: 0, b: 0, a: 255 } },
      { ...validPreview, liveRect: { x: 2, y: 2, width: 3, height: 1 } },
      { ...validPreview, phase: "floating" },
      "invalid",
      { phase: "unknown" },
      { phase: "selected", rect: { x: 0.5, y: 0, width: 2, height: 1 }, mask: "full" },
      { phase: "selected", rect: { x: 0, y: 0, width: -2, height: 1 }, mask: "full" },
      { phase: "selected", rect: { x: 0, y: 0, width: 33, height: 33 }, mask: "full" },
      { phase: "selected", rect: { x: 0, y: 0, width: 2, height: 1 }, mask: "AA==" },
      { phase: "selected", rect: { x: 0, y: 0, width: 2, height: 1 }, mask: "!!!=" }
    ];
    for (const payload of malformed) {
      peerRoom.emit("peer-presence", {
        clientId: "owner",
        patch: ownerRoom.presence
      });
      assertSelection(owner, peer);
      peerRoom.emit("peer-presence", {
        clientId: "owner",
        patch: { selectionGhost: payload }
      });
      assert.equal(peer.manager.peerPresence.selectionOutlines.isActive, false);
    }
  });
});
