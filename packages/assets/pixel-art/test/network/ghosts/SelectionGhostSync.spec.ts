// Import Node.js Dependencies
import { describe, test, type TestContext } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { PeerMetadata } from "@jolly-pixel/network";
import {
  SelectionPresence,
  type SelectionPresenceData
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { StandalonePixelHistory } from "#src/history/PixelCanvasHistory.ts";
import { SelectionGhostSync } from "#src/network/ghosts/SelectionGhostSync.ts";
import {
  decodeSelectionPresence,
  encodeSelectionPresence
} from "#src/network/ghosts/SelectionPresenceCodec.ts";
import {
  createPixelArtCanvas,
  type CreatedPixelArtCanvas
} from "../../helpers/canvas.ts";
import { mouseEvent } from "../../helpers/events.ts";
import { nextFrame } from "../../helpers/mock.ts";
import { MockRoom } from "../../helpers/room.ts";
import { mockContextOf, readPixel } from "../../fixtures/canvas.ts";
import { command, gray } from "../../fixtures/commands.ts";

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

function pathOf(
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
    pathOf(peer, "[data-layer=peer-selections] path"),
    pathOf(owner, "[data-overlay=selection]")
  );
}

function previewPixels(
  peer: CreatedPixelArtCanvas
): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const context = mockContextOf(canvas);
  peer.manager.peerPresence.floatingSelections.draw(context.asRenderingContext());

  return context.pixels;
}

describe("SelectionGhostSync selection lifecycle", () => {
  test("completed and stationary selections stay visible until deselected", async(t) => {
    const { owner, peer } = setup(t);
    selectPair(owner);
    assertSelection(owner, peer);
    await nextFrame();
    assertSelection(owner, peer);
    assert.equal(peer.manager.peerPresence.floatingSelections.isActive, false);
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
    t.mock.timers.tick(60 * 60 * 1000);
    assertSelection(owner, peer);
    t.mock.timers.reset();

    owner.manager.mode = "paint";
    await nextFrame();
    assert.equal(peer.manager.peerPresence.selectionOutlines.isActive, false);
  });

  test("moves transmit exact pixels and erase color, then keep the final outline", async(t) => {
    const { owner, peer, peerRoom } = setup(t);
    selectPair(owner);
    owner.canvas.dispatchEvent(mouseEvent("mousedown", 95, 95));
    owner.canvas.dispatchEvent(mouseEvent("mousemove", 95, 103));
    await nextFrame();
    assertSelection(owner, peer);
    const pixels = previewPixels(peer);
    assert.deepEqual(readPixel(pixels, { x: 2, y: 4 }, 8), [0, 0, 0, 255]);
    assert.deepEqual(readPixel(pixels, { x: 3, y: 4 }, 8), [255, 0, 0, 255]);
    assert.deepEqual(readPixel(pixels, { x: 2, y: 2 }, 8), [255, 0, 255, 255]);
    owner.canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    assertSelection(owner, peer);
    assert.equal(peer.manager.peerPresence.floatingSelections.isActive, false);
    assert.deepEqual(peer.manager.texture, owner.manager.texture);

    peerRoom.deliverCommand(command("select-edit", {
      positions: [{ x: 2, y: 4 }],
      colors: [gray(30)]
    }, { clientId: "another-peer" }));
    assertSelection(owner, peer);
    await nextFrame();
    assertSelection(owner, peer);
  });

  test("shape masks, stationary floating paste and transforms reach the peer", async(t) => {
    const { owner, peer } = setup(t);
    owner.manager.brush.primary.set("#000000");
    owner.manager.commitPixels([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 3 }
    ]);
    owner.manager.mode = "select";
    owner.manager.tools.select.shape = true;
    owner.canvas.dispatchEvent(mouseEvent("mousedown", 93, 93));
    owner.canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    assertSelection(owner, peer);
    assert.deepEqual(owner.manager.selectionPresence?.toJSON(), {
      phase: "selected",
      rect: { x: 2, y: 2, width: 2, height: 2 },
      mask: [true, true, true, false]
    });
    assert.equal((await owner.manager.copySelection()).code, "copied-internal-only");
    owner.manager.mode = "paint";
    owner.canvas.dispatchEvent(mouseEvent("mousemove", 104, 104));
    assert.equal((await owner.manager.pasteClipboard()).code, "pasted");
    assertSelection(owner, peer);
    assert.equal(peer.manager.peerPresence.floatingSelections.isActive, true);
    const floating = owner.manager.selectionPresence?.toJSON();
    assert.ok(floating !== undefined && "liveRect" in floating);
    const pixels = previewPixels(peer);
    assert.deepEqual(readPixel(pixels, floating.liveRect, 8), [0, 0, 0, 255]);
    assert.deepEqual(readPixel(peer.manager.texture, floating.liveRect, 8), [255, 255, 255, 255]);
    owner.manager.tools.select.rotate();
    owner.manager.tools.select.flipHorizontal();
    owner.manager.tools.select.flipVertical();
    assertSelection(owner, peer);
    const transformed = owner.manager.selectionPresence?.toJSON();
    assert.ok(transformed !== undefined && "liveRect" in transformed);
    const transformedPixels = previewPixels(peer);
    for (let index = 0; index < transformed.mask.length; index++) {
      const position = {
        x: transformed.liveRect.x + index % transformed.liveRect.width,
        y: transformed.liveRect.y + Math.floor(index / transformed.liveRect.width)
      };
      const color = transformed.pixels[index];
      assert.deepEqual(readPixel(transformedPixels, position, 8),
        transformed.mask[index] ? [color.r, color.g, color.b, color.a] : [0, 0, 0, 0]);
    }
    owner.manager.tools.select.delete();
    assert.equal(peer.manager.peerPresence.selectionOutlines.isActive, false);
    assert.equal(peer.manager.peerPresence.floatingSelections.isActive, false);
  });

  test("depositing a floating selection keeps its final outline", async(t) => {
    const { owner, peer } = setup(t);
    selectPair(owner);
    await owner.manager.copySelection();
    owner.manager.mode = "paint";
    owner.canvas.dispatchEvent(mouseEvent("mousemove", 104, 104));
    assert.equal((await owner.manager.pasteClipboard()).code, "pasted");
    owner.manager.tools.select.flipHorizontal();
    drag(owner.canvas, [103, 107], [107, 111]);
    assertSelection(owner, peer);
    assert.equal(peer.manager.peerPresence.floatingSelections.isActive, false);
    assert.deepEqual(peer.manager.texture, owner.manager.texture);
    await nextFrame();
    assertSelection(owner, peer);
  });

  test("resize, transforms, delete and history retain the correct selection", (t) => {
    const { owner, peer } = setup(t);
    selectPair(owner);
    drag(owner.canvas, [92, 92], [88, 88]);
    assertSelection(owner, peer);
    owner.manager.tools.select.rotate();
    assertSelection(owner, peer);
    owner.manager.undo();
    assertSelection(owner, peer);
    owner.manager.redo();
    assertSelection(owner, peer);
    owner.manager.tools.select.delete();
    assertSelection(owner, peer);
    assert.deepEqual(peer.manager.texture, owner.manager.texture);
  });

  test("no-op moves and interruption replace queued previews", async(t) => {
    const { owner, peer } = setup(t);
    selectPair(owner);
    owner.canvas.dispatchEvent(mouseEvent("mousedown", 95, 95));
    owner.canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    assertSelection(owner, peer);
    owner.canvas.dispatchEvent(mouseEvent("mousedown", 95, 95));
    owner.canvas.dispatchEvent(mouseEvent("mousemove", 95, 103));
    owner.manager.mode = "paint";
    await nextFrame();
    assert.equal(peer.manager.peerPresence.selectionOutlines.isActive, false);
    assert.equal(peer.manager.peerPresence.floatingSelections.isActive, false);
  });

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
