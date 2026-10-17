// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PeerMetadata } from "@jolly-pixel/network";

// Import Internal Dependencies
import { StandalonePixelHistory } from "#src/history/PixelCanvasHistory.ts";
import { SelectionGhostSync } from "#src/network/ghosts/SelectionGhostSync.ts";
import { createPixelArtCanvas, type CreatedPixelArtCanvas } from "../../helpers/canvas.ts";
import { mouseEvent } from "../../helpers/events.ts";
import { MockRoom } from "../../helpers/room.ts";

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

describe("SelectionGhostSync selection lifecycle", () => {
  test("late attachment, join, snapshots and reconnect replay retained presence", (t) => {
    const { owner, peer, ownerRoom, peerRoom, ownerSync } = setup(t);
    selectPair(owner);
    ownerSync.destroy();
    assert.equal(peer.manager.peerPresence.selectionOutlines.isActive, false);
    const replacement = new SelectionGhostSync({
      room: ownerRoom,
      canvas: owner.manager,
      color: () => "#123456"
    });
    t.after(() => replacement.destroy());
    assertSelection(owner, peer);
    const late = createPixelArtCanvas({ zoom: { default: 4, smoothing: 0 } });
    const lateRoom = new MockRoom({ clientId: "late-peer" });
    lateRoom.addPeer("owner", { presence: ownerRoom.presence });
    const lateSync = new SelectionGhostSync({
      room: lateRoom,
      canvas: late.manager,
      color: () => "#123456"
    });
    t.after(() => {
      lateSync.destroy();
      late.manager.destroy();
    });
    assertSelection(owner, late);
    peer.manager.peerPresence.selectionOutlines.clearAll();
    peerRoom.deliverSnapshot();
    assertSelection(owner, peer);

    peerRoom.peers.clear();
    peerRoom.emit("left");
    assert.equal(peer.manager.peerPresence.selectionOutlines.isActive, false);
    peerRoom.addPeer("new-owner-id", { presence: ownerRoom.presence });
    peerRoom.emit("sync", { self: "peer", clientIds: ["new-owner-id"] });
    assertSelection(owner, peer);
    peerRoom.peers.delete("new-owner-id");
    peerRoom.emit("peer-left", { clientId: "new-owner-id" });
    assert.equal(peer.manager.peerPresence.selectionOutlines.isActive, false);
  });

  test("texture replacement clears the owner's published selection", (t) => {
    const { owner, peer } = setup(t);
    selectPair(owner);
    owner.manager.clearTexture();
    assert.equal(peer.manager.peerPresence.selectionOutlines.isActive, false);
  });
});
