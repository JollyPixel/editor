// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  JollyReparentDetail,
  TreeDropWhere
} from "@jolly-pixel/ui";
import { AnimationDocument } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import {
  MENU_POINT,
  clipLabels,
  createPanelHarness,
  createSetSource,
  createSharedSetSource
} from "./panelHarness.ts";

function reparent(
  movedId: string,
  targetId: string,
  where: TreeDropWhere
): CustomEvent<JollyReparentDetail> {
  return new CustomEvent("jolly-reparent", {
    detail: {
      movedIds: [movedId],
      targetId,
      where
    }
  });
}

describe("AnimatePanelController clip rows", () => {
  test("copies a clip of the model to a shared set, keys included, and keeps the original", async() => {
    const { controller, animations, pick, names, rowAction } = createPanelHarness();
    controller.actions!.linkSet(MENU_POINT);
    await pick("Humanoid");
    names.push("Wave");
    await controller.actions!.newClip(null);
    const own = animations.ownSet()!;
    const [wave] = own.document.set.clips();
    own.document.setKey(wave.id, "Body", "position", {
      tick: 0,
      value: { x: 1, y: 0, z: 0 },
      interpolation: "linear"
    });

    await rowAction("Wave", "Copy to…");
    await pick("Humanoid");

    const [copy] = animations.set("shared")!.document.set.clips();
    assert.deepEqual(clipLabels(controller.state.ownClips), ["Wave"]);
    assert.equal(copy.name, "Wave");
    assert.deepEqual(copy.tracks.map(({ path }) => path), ["Body"]);
    assert.deepEqual(controller.state.clip?.clip.id, copy.id);
  });

  test("copying a set clip into the model forks it, asking for a free name on a clash", async() => {
    const source = createSharedSetSource();
    const shared = new AnimationDocument();
    shared.addClip({ id: "walk", name: "Walk" });
    source.documents.set("shared", shared);
    const { controller, pick, names, prompts, rowAction } = createPanelHarness(source);
    controller.actions!.linkSet(MENU_POINT);
    await pick("Humanoid");
    names.push("Walk");
    await controller.actions!.newClip(null);

    await rowAction("Walk", "Copy to…", "shared");
    await pick("This model");

    assert.equal(prompts.at(-1)?.heading, "Copy \"Walk\" to this model");
    assert.equal(prompts.at(-1)?.defaultName, "Walk 2");
    assert.deepEqual(clipLabels(controller.state.ownClips), ["Walk", "Walk 2"]);
    assert.deepEqual([...shared.set.clips()].map(({ name }) => name), ["Walk"]);
  });

  test("duplicates a clip next to it as a free \"Copy\" name", async() => {
    const { controller, names, rowAction } = createPanelHarness();
    names.push("Walk", "Run");
    await controller.actions!.newClip(null);
    await controller.actions!.newClip(null);

    await rowAction("Walk", "Duplicate");
    await rowAction("Walk", "Duplicate");

    assert.deepEqual(clipLabels(controller.state.ownClips), ["Walk", "Walk Copy 2", "Walk Copy", "Run"]);
  });

  test("a dropped clip reorders its own set, and never lands in another set", async() => {
    const source = createSetSource([
      { id: "shared", kind: "voxelanimation", name: "Humanoid" },
      { id: "props", kind: "voxelanimation", name: "Props" }
    ]);
    const { controller, animations, names } = createPanelHarness(source);
    animations.link("shared");
    animations.link("props");
    names.push("Walk", "Run", "Spin", "Roll");
    await controller.actions!.newClip(null);
    await controller.actions!.newClip(null);
    await controller.actions!.newClip("shared");
    await controller.actions!.newClip("props");
    const [walk, run] = controller.state.ownClips;
    const [humanoid, props] = controller.state.sharedSets;
    const spin = humanoid.children![0];
    const accepts = controller.acceptDrop("shared");

    controller.handleReparent("own", reparent(run.id, walk.id, "above"));

    assert.deepEqual(clipLabels(controller.state.ownClips), ["Run", "Walk"]);
    assert.equal(accepts(reparent(spin.id, props.id, "inside").detail), false);
    assert.equal(accepts(reparent(spin.id, props.children![0].id, "above").detail), false);
  });

  test("Copy is the only way out of a set, and disabled with nowhere to put the clip", async() => {
    const { controller } = createPanelHarness();
    await controller.actions!.newClip(null);
    const [row] = controller.state.ownClips;

    const items = controller.rowMenu(row.id).items.filter((entry) => entry !== "separator");

    assert.deepEqual(
      items.map(({ label, disabled = false }) => [label, disabled]),
      [["Rename", false], ["Duplicate", false], ["Copy to…", true], ["Delete", false]]
    );
  });
});
