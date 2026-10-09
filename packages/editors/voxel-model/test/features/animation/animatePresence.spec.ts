// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AnimatePresence,
  decodeAnimateCursor
} from "#src/features/animation/collaboration/AnimatePresence.ts";
import { createRoomHarness } from "../../collaboration/roomHarness.ts";
import { createAnimatedModel } from "./fixtures.ts";

function createHarness() {
  const room = createRoomHarness();
  room.addPeer("bob");
  const model = createAnimatedModel();
  const presence = new AnimatePresence({
    room: room.room,
    session: model.animationSession,
    keyEditor: model.keyEditor,
    presence: model.presence
  });
  function patch(
    value: Record<string, unknown>
  ): void {
    room.emit("peer-presence", { clientId: "bob", patch: value });
  }

  return { ...room, model, presence, patch };
}

function lastPublished(
  published: readonly Record<string, unknown>[],
  key: string
): unknown {
  return published.findLast((patch) => key in patch)?.[key];
}

describe("AnimatePresence", () => {
  test("publishes my cursor only while Animate is open", () => {
    const { model, presence, published } = createHarness();
    const wave = `clip:walk:${model.clipId}`;
    assert.equal(lastPublished(published, "animateCursor"), null);

    model.tab.activate("animate");
    assert.deepEqual(lastPublished(published, "animateCursor"), {
      clip: wave,
      tick: 0,
      keys: []
    });

    model.tab.activate("build");
    assert.equal(lastPublished(published, "animateCursor"), null);
    presence.dispose();
  });

  test("shares peers' clips by key, unchanged while only their playhead moves", () => {
    const { model, presence, patch } = createHarness();
    const wave = `clip:walk:${model.clipId}`;
    let focusChanges = 0;
    model.presence.on("clipFocusesChange", () => {
      focusChanges++;
    });

    patch({ animateCursor: { clip: wave, tick: 0, keys: [] } });
    const marked = [...model.presence.clipFocuses].map(([clip, peers]) => [
      clip,
      peers.map(({ displayName }) => displayName)
    ]);
    assert.deepEqual(marked, [[wave, ["bob"]]]);

    patch({ animateCursor: { clip: wave, tick: 6000, keys: [] } });
    assert.equal(focusChanges, 1);

    patch({ animateCursor: null });
    assert.equal(model.presence.clipFocuses.size, 0);
    presence.dispose();
  });

  test("shares peers' cursors by client", () => {
    const { model, presence, patch } = createHarness();
    const clip = `clip:walk:${model.clipId}`;
    const keys = [{ path: "Body/Arm", tick: 0 }];

    patch({ animateCursor: { clip, tick: 6000, keys } });
    patch({ animateCursor: { clip, tick: 7000, keys } });

    assert.deepEqual(
      model.presence.animateCursors.map(({ peer, cursor }) => [peer.displayName, cursor]),
      [["bob", { clip, tick: 7000, keys }]]
    );

    presence.dispose();
    assert.equal(model.presence.animateCursors.length, 0);
  });

  test("sends a newly shown clip without waiting for the throttle", () => {
    const { model, presence, published } = createHarness();
    model.tab.activate("animate");
    const run = model.set.addClip({ id: "run", name: "Run", length: 24000 })!;

    model.animationFocus.focusClip("walk", run);
    assert.deepEqual(lastPublished(published, "animateCursor"), {
      clip: "clip:walk:run",
      tick: 0,
      keys: []
    });
    presence.dispose();
  });

  test("rejects a malformed cursor", () => {
    assert.equal(decodeAnimateCursor(null), null);
    assert.equal(decodeAnimateCursor({ clip: "walk:wave", tick: 0, keys: [] }), undefined);
    assert.equal(decodeAnimateCursor({ clip: "set:walk", tick: 0, keys: [] }), undefined);
    assert.equal(decodeAnimateCursor({ clip: "clip:walk:wave", tick: "0", keys: [] }), undefined);
    assert.equal(decodeAnimateCursor({ clip: "clip:walk:wave", tick: 0, keys: [1] }), undefined);
    assert.equal(decodeAnimateCursor({ clip: "clip:walk:wave", tick: 0, keys: ["0:Body/Arm"] }), undefined);
    assert.equal(
      decodeAnimateCursor({ clip: "clip:walk:wave", tick: 0, keys: [{ path: "Body/Arm" }] }),
      undefined
    );
    assert.equal(decodeAnimateCursor({ tick: 0, keys: [] }), undefined);
  });
});
