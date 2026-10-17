// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  timelineRows,
  unboundTimelineRows
} from "#src/features/animation/timeline/timelineRows.ts";
import { createAnimatedModel } from "./fixtures.ts";

describe("timelineRows", () => {
  test("lists keyed blocks and the selected one in hierarchy order, with each key's interpolation", () => {
    const model = createAnimatedModel();
    model.set.writeKey(model.clipId, "Body/Arm", "scale", {
      tick: 0,
      value: { x: 1, y: 1, z: 1 },
      interpolation: "step"
    });
    const { tree } = model.document;
    const clip = model.set.set.clip(model.clipId)!;
    const link = tree.animationSets.get("walk")!;

    assert.deepEqual(timelineRows(tree, clip, link, model.ids.body), [
      { blockId: model.ids.body, name: "Body", path: "Body", keys: [], selected: true },
      {
        blockId: model.ids.arm,
        name: "Arm",
        path: "Body/Arm",
        keys: [{ tick: 0, interpolation: "mixed" }, { tick: 24000, interpolation: "linear" }],
        selected: false
      }
    ]);
    assert.deepEqual(
      timelineRows(tree, clip, link, null).map(({ name }) => name),
      ["Arm"]
    );
  });

  test("lists the clip's unbound tracks with their state and keys until they are rebound", () => {
    const model = createAnimatedModel();
    const { document } = model;
    model.set.writeKey(model.clipId, "Body/Leg", "position", {
      tick: 12000,
      value: { x: 0, y: 1, z: 0 },
      interpolation: "step"
    });
    document.remapAnimationTrack("walk", "Body/Arm", null);
    function unbound() {
      const clip = model.set.set.clip(model.clipId)!;

      return unboundTimelineRows(document.tree, clip, document.tree.animationSets.get("walk")!);
    }

    assert.deepEqual(unbound(), [
      {
        path: "Body/Arm",
        name: "Arm",
        state: "ignored",
        keys: [{ tick: 0, interpolation: "linear" }, { tick: 24000, interpolation: "linear" }]
      },
      { path: "Body/Leg", name: "Leg", state: "missing", keys: [{ tick: 12000, interpolation: "step" }] }
    ]);

    document.clearAnimationTrackRemap("walk", "Body/Arm");
    document.remapAnimationTrack("walk", "Body/Leg", "Body");

    assert.deepEqual(unbound(), []);
  });
});
