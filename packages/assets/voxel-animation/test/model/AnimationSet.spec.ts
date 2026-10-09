// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { AnimationSet } from "#src/model/AnimationSet.ts";
import { InvalidAnimationSetError } from "#src/model/errors/InvalidAnimationSetError.ts";
import {
  imageOf,
  restoreImages
} from "#src/model/history/animationImages.ts";
import type { AnimationCommand } from "#src/network/types.ts";
import {
  clip,
  key
} from "../helpers/clips.ts";

function setOf(
  ...commands: AnimationCommand[]
): AnimationSet {
  const set = new AnimationSet();
  for (const command of commands) {
    assert.equal(set.accepts(command), true, command.action);
    set.apply(command);
  }

  return set;
}

describe("AnimationSet", () => {
  test("a track path in another case or spacing is the same track", () => {
    const set = setOf(
      { action: "clip-added", clip: clip("walk") },
      { action: "key-set", clipId: "walk", path: "Body/Arm", channel: "position", key: key(0, 1) },
      { action: "key-set", clipId: "walk", path: "body/ ARM ", channel: "position", key: key(12, 2) },
      { action: "clip-added", clip: clip("run", { tracks: [{ path: "BODY/arm" }, { path: "Leg" }] }) }
    );

    assert.deepEqual(
      set.clip("walk")?.tracks.map(({ path, position }) => [path, position?.map(({ tick }) => tick)]),
      [["Body/Arm", [0, 12]]]
    );
    assert.equal(set.keyAt("walk", "BODY/arm", "position", 12)?.value.x, 2);
    assert.deepEqual(set.trackPaths(), ["Body/Arm", "Leg"]);
    assert.equal(set.accepts({
      action: "clip-added",
      clip: clip("run", { tracks: [{ path: "Body/Arm" }, { path: "body/arm" }] })
    }), false);
  });

  test("renames a track with its keys, refusing a path another track holds", () => {
    const set = setOf(
      { action: "clip-added", clip: clip("walk") },
      { action: "key-set", clipId: "walk", path: "Body/Arm", channel: "position", key: key(0, 1) },
      { action: "key-set", clipId: "walk", path: "Body/Leg", channel: "position", key: key(0, 2) }
    );

    function renames(
      to: string
    ): boolean {
      return set.accepts({ action: "track-renamed", clipId: "walk", path: "body/arm", to });
    }
    assert.deepEqual([renames("body/LEG"), renames("Body/Arm"), renames("BODY/ARM")], [false, false, true]);

    set.apply({ action: "track-renamed", clipId: "walk", path: "body/arm", to: "Torso/Arm" });
    assert.deepEqual(set.clip("walk")?.tracks.map(({ path }) => path), ["Torso/Arm", "Body/Leg"]);
    assert.equal(set.keyAt("walk", "torso/arm", "position", 0)?.value.x, 1);
  });

  test("compares clip names trimmed and in any case, and finds a free one", () => {
    const set = setOf(
      { action: "clip-added", clip: clip("walk", { name: "Walk" }) },
      { action: "clip-added", clip: clip("walk-2", { name: "Walk 2" }) }
    );

    assert.equal(set.clipNameTaken(" walk "), true);
    assert.equal(set.clipNameTaken("WALK", "walk"), false);
    assert.equal(set.freeClipName("Run"), "Run");
    assert.equal(set.freeClipName("walk 2"), "walk 3");
  });

  test("keeps clips in order and places one before a sibling", () => {
    const set = setOf(
      { action: "clip-added", clip: clip("walk") },
      { action: "clip-added", clip: clip("run") },
      { action: "clip-added", clip: clip("idle"), beforeId: "walk" },
      { action: "clip-moved", id: "run", beforeId: "idle" }
    );

    assert.deepEqual([...set.clips()].map(({ id }) => id), ["run", "idle", "walk"]);
    assert.equal(set.nextClipOf("idle"), "walk");
    assert.equal(set.nextClipOf("walk"), undefined);
  });

  test("sets keys in tick order, replacing one at the same tick", () => {
    const rotation = {
      action: "key-set",
      clipId: "walk",
      path: "body/arm",
      channel: "rotation"
    } as const;
    const set = setOf(
      { action: "clip-added", clip: clip("walk") },
      { ...rotation, key: key(12000, 90) },
      { ...rotation, key: key(0, 0) },
      { ...rotation, key: key(12000, 45, "step") }
    );

    assert.deepEqual(set.clip("walk")?.tracks, [{
      path: "body/arm",
      rotation: [key(0, 0), key(12000, 45, "step")]
    }]);
  });

  test("drops an emptied channel, then the emptied track", () => {
    const set = setOf(
      { action: "clip-added", clip: clip("walk") },
      { action: "key-set", clipId: "walk", path: "arm", channel: "position", key: key(0, 1) },
      { action: "key-set", clipId: "walk", path: "arm", channel: "scale", key: key(0, 2) },
      { action: "key-removed", clipId: "walk", path: "arm", channel: "position", tick: 0 }
    );
    assert.deepEqual(set.clip("walk")?.tracks, [{ path: "arm", scale: [key(0, 2)] }]);

    set.apply({ action: "key-removed", clipId: "walk", path: "arm", channel: "scale", tick: 0 });
    assert.deepEqual(set.clip("walk")?.tracks, []);
  });

  test("refuses commands on missing clips, keys and tracks, and frame rates off the tick grid", () => {
    const set = setOf({ action: "clip-added", clip: clip("walk") });

    assert.equal(set.accepts({ action: "clip-added", clip: clip("walk") }), false);
    assert.equal(set.accepts({ action: "clip-added", clip: clip("run", { fps: 7 }) }), false);
    assert.equal(set.accepts({ action: "clip-added", clip: clip("run"), beforeId: "missing" }), false);
    assert.equal(set.accepts({ action: "clip-changed", id: "walk", patch: {} }), false);
    assert.equal(set.accepts({ action: "clip-changed", id: "walk", patch: { fps: 7 } }), false);
    assert.equal(set.accepts({ action: "clip-moved", id: "walk", beforeId: "walk" }), false);
    const scale = {
      path: "arm",
      channel: "scale"
    } as const;
    assert.equal(set.accepts({ action: "key-set", clipId: "run", ...scale, key: key(0, 1) }), false);
    assert.equal(set.accepts({ action: "key-removed", clipId: "walk", ...scale, tick: 0 }), false);
    assert.equal(set.accepts({ action: "track-removed", clipId: "walk", path: "arm" }), false);
  });

  test("changes only the clip fields a patch names", () => {
    const set = setOf(
      { action: "clip-added", clip: clip("walk") },
      { action: "clip-changed", id: "walk", patch: { loop: false, fps: 30 } }
    );

    assert.deepEqual(set.clip("walk"), clip("walk", { loop: false, fps: 30 }));
  });

  test("rejects a snapshot with a repeated clip or keys out of order, keeping the previous set", () => {
    const set = setOf({ action: "rig-renamed", rig: "Humanoid" });

    assert.throws(
      () => set.load({ rig: "", clips: [clip("a"), clip("a")] }),
      InvalidAnimationSetError
    );
    assert.throws(
      () => set.load({
        rig: "",
        clips: [clip("a", { tracks: [{ path: "arm", position: [key(10, 0), key(5, 0)] }] })]
      }),
      InvalidAnimationSetError
    );
    assert.equal(set.rig, "Humanoid");
  });

  test("restores the images of several commands, newest first", () => {
    const set = setOf(
      { action: "clip-added", clip: clip("walk") },
      { action: "clip-added", clip: clip("run") }
    );
    const before = set.toJSON();
    const commands: AnimationCommand[] = [
      { action: "rig-renamed", rig: "Humanoid" },
      { action: "key-set", clipId: "walk", path: "arm", channel: "position", key: key(0, 1) },
      { action: "clip-removed", id: "run" },
      { action: "clip-added", clip: clip("jump"), beforeId: "walk" }
    ];
    const images = commands.map((command) => {
      const image = imageOf(set, command);
      set.apply(command);

      return image;
    });

    assert.deepEqual(restoreImages(set.toJSON(), images), before);
  });
});
