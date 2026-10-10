// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AnimationDocument,
  type AnimationChange
} from "#src/model/AnimationDocument.ts";
import { InvalidAnimationSetError } from "#src/model/errors/InvalidAnimationSetError.ts";
import { inverseOf } from "#src/model/history/animationInverse.ts";
import { TICKS_PER_SECOND } from "#src/model/values/FrameRate.ts";
import { key } from "../helpers/clips.ts";

function createDocument(): AnimationDocument {
  const document = new AnimationDocument();
  document.renameRig("Humanoid");
  document.addClip({ id: "walk", name: "Walk" });
  document.addClip({ id: "run", name: "Run" });
  document.setKey("walk", "body/arm", "rotation", key(0, 0));
  document.setKey("walk", "body/arm", "rotation", key(12000, 90));
  document.setKey("walk", "body/arm", "position", key(6000, 1));

  return document;
}

describe("AnimationDocument", () => {
  test("adds a clip with defaults and tags local edits", () => {
    const document = new AnimationDocument();
    const changes: AnimationChange[] = [];
    document.on("change", (change) => changes.push(change));

    const id = document.addClip({ name: "Idle" });

    assert.ok(id);
    assert.match(id, /^[0-9A-Za-z]{12}$/);
    assert.deepEqual(document.set.clip(id), {
      id,
      name: "Idle",
      length: TICKS_PER_SECOND,
      fps: 24,
      loop: false,
      tracks: []
    });
    assert.deepEqual(changes.map(({ origin }) => origin), ["local"]);
    assert.equal(document.addClip({ id, name: "Again" }), null);
  });

  test("adds a clip with a copy of the given tracks", () => {
    const source = createDocument();
    const { tracks } = source.set.clip("walk")!;
    const document = new AnimationDocument();

    const id = document.addClip({ name: "Walk", tracks })!;
    source.setKey("walk", "body/arm", "rotation", key(0, 45));

    assert.deepEqual(document.set.clip(id)?.tracks, createDocument().set.clip("walk")?.tracks);
  });

  test("rounds key values to four decimals", () => {
    const document = new AnimationDocument();
    const noisy = {
      tick: 0,
      value: { x: 0.006363961030678927, y: 5.5e-19, z: -0.00001 },
      interpolation: "smooth" as const
    };
    const rounded = {
      ...noisy,
      value: { x: 0.0064, y: 0, z: 0 }
    };

    const id = document.addClip({ name: "Spin", tracks: [{ path: "ring", rotation: [noisy] }] })!;
    document.setKey(id, "ring", "position", noisy);

    assert.deepStrictEqual(document.set.keyAt(id, "ring", "rotation", 0), rounded);
    assert.deepStrictEqual(document.set.keyAt(id, "ring", "position", 0), rounded);
  });

  const kEdits: Record<string, (document: AnimationDocument) => boolean> = {
    "rename the rig": (document) => document.renameRig("Quadruped"),
    "remove a clip": (document) => document.removeClip("walk"),
    "change a clip": (document) => document.changeClip("walk", { name: "Stroll", fps: 30 }),
    "move a clip": (document) => document.moveClip("run", "walk"),
    "add a key": (document) => document.setKey("walk", "body/leg", "scale", key(0, 2)),
    "replace a key": (document) => document.setKey("walk", "body/arm", "rotation", key(12000, 45)),
    "remove a key": (document) => document.removeKey("walk", "body/arm", "position", 6000),
    "remove a track": (document) => document.removeTrack("walk", "body/arm"),
    "rename a track": (document) => document.renameTrack("walk", "body/arm", "Torso/Arm")
  };

  for (const [name, edit] of Object.entries(kEdits)) {
    test(`its inverse undoes: ${name}`, () => {
      const document = createDocument();
      const before = document.set.toJSON();
      const changes: AnimationChange[] = [];
      document.on("change", (change) => changes.push(change));

      assert.equal(edit(document), true);
      assert.notDeepEqual(document.set.toJSON(), before);
      for (const command of changes.at(-1)!.inverse) {
        assert.notEqual(document.applyStep(command, undefined), null, command.action);
      }

      assert.deepEqual(document.set.toJSON(), before);
    });
  }

  test("computes no inverse for a remote edit", () => {
    const document = createDocument();
    const changes: AnimationChange[] = [];
    document.on("change", (change) => changes.push(change));

    document.apply({ action: "rig-renamed", rig: "Peer" });

    assert.deepEqual(changes.map(({ origin, inverse }) => [origin, inverse]), [["remote", []]]);
  });

  test("refuses to invert a command the set would refuse", () => {
    const document = createDocument();

    assert.throws(
      () => inverseOf(document.set, { action: "clip-removed", id: "missing" }),
      InvalidAnimationSetError
    );
  });
});
