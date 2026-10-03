// Import Node.js Dependencies
import assert from "node:assert/strict";
import { describe, test } from "node:test";

// Import Third-party Dependencies
import { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { SceneWaker } from "#src/scene/SceneWaker.ts";
import {
  PresenceStore,
  ViewSettingsStore
} from "#src/state/index.ts";
import { TransformLock } from "#src/features/transform/collaboration/TransformLock.ts";
import { createModelFixture } from "../fixtures/model.ts";
import { createRoomHarness } from "../collaboration/roomHarness.ts";

function createHarness() {
  const { document, previews } = createModelFixture();
  const pixels = new PixelDocument({ size: { x: 16, y: 16 } });
  const presence = new PresenceStore();
  const room = createRoomHarness();
  const lock = new TransformLock({ room: room.room });
  const view = new ViewSettingsStore();
  const frames = { requested: 0 };
  const waker = new SceneWaker({
    document,
    previews,
    pixels,
    presence,
    lock,
    view,
    requestFrame: () => frames.requested++
  });

  return {
    document,
    previews,
    pixels,
    presence,
    room,
    lock,
    view,
    frames,
    waker
  };
}

describe("SceneWaker", () => {
  test("requests a frame on model changes and snapshot resets", () => {
    const { document, frames } = createHarness();

    document.addBlock({ name: "Block" });
    document.load({ nodes: [], materials: [] });

    assert.equal(frames.requested, 2);
  });

  test("requests a frame on peer presence and view changes", () => {
    const { presence, view, frames } = createHarness();

    presence.peers = [];
    presence.blockSelections = new Map();
    presence.blockHovers = new Map();
    view.update({ shading: view.settings.shading === "lit" ? "flat" : "lit" });

    assert.equal(frames.requested, 4);
  });

  test("requests a frame on texture pixel changes", () => {
    const { pixels, frames } = createHarness();

    pixels.resize({ x: 32, y: 32 });

    assert.equal(frames.requested, 1);
  });

  test("requests a frame when a peer takes a transform lock", () => {
    const { room, frames } = createHarness();

    room.addPeer("bob", {
      profile: { username: "Bob", peerId: "bob" },
      presence: { transformLock: "uuid-1" }
    });
    room.emitSync();

    assert.equal(frames.requested, 1);
  });

  test("stops requesting frames once disposed", () => {
    const { document, presence, waker, frames } = createHarness();

    waker.dispose();
    document.addBlock({ name: "Block" });
    presence.peers = [];

    assert.equal(frames.requested, 0);
  });
});
