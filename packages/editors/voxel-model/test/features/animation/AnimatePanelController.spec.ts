// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { animationKey } from "#src/state/index.ts";
import { ANIMATION_LIBRARY } from "#src/features/history/index.ts";
import {
  MENU_POINT,
  clipLabels,
  createPanelHarness,
  createSetSource
} from "./panelHarness.ts";

describe("AnimatePanelController", () => {
  test("badges a clip row with the peers who have it open", () => {
    const { controller, animations, presence } = createPanelHarness();
    animations.link("shared");
    const clipId = animations.set("shared")!.document.addClip({ name: "Wave" })!;
    const peer = { clientId: "bob", displayName: "Bob", color: "#ff0000" };
    const clip = animationKey("shared", clipId);
    function badges() {
      return controller.state.sharedSets[0].children?.[0]?.badges;
    }

    presence.animateCursors = [{ peer, cursor: { clip, tick: 0, keys: [] } }];
    const { state } = controller;
    assert.deepEqual(badges(), [{ color: "#ff0000", title: "Bob" }]);

    presence.animateCursors = [{ peer, cursor: { clip, tick: 6000, keys: [] } }];
    assert.equal(controller.state, state, "a moving playhead leaves the rows alone");

    presence.animateCursors = [];
    assert.deepEqual(badges(), []);
  });

  test("falls back to the set and names the peer who deleted the open clip", () => {
    const { controller, animations, animationFocus, presence } = createPanelHarness();
    animations.link("shared");
    const { document } = animations.set("shared")!;
    const clipId = document.addClip({ name: "Wave" })!;
    animationFocus.focusClip("shared", clipId);
    presence.peers = [{ clientId: "bob", displayName: "Bob", color: "#ff0000" }];

    document.applyRemote({ action: "clip-removed", id: clipId }, "bob");

    assert.deepEqual(animationFocus.focus, { setId: "shared", clipId: null });
    assert.equal(controller.state.notice, "Bob deleted the clip you had open.");

    controller.handleSelect(new CustomEvent("jolly-select", {
      detail: { selected: [animationKey("shared")] }
    }));
    assert.equal(controller.state.notice, null, "picking the set it fell back to clears the notice");

    document.addClip({ id: "again", name: "Again" });
    animationFocus.focusClip("shared", "again");
    document.applyRemote({ action: "clip-removed", id: "again" }, "bob");
    animationFocus.focusSet(null);
    assert.equal(controller.state.notice, null);

    animationFocus.focusSet("shared");
    assert.equal(controller.state.notice, null, "coming back to the set does not bring the notice back");
  });

  test("names the peer who deleted the open clip once the roster knows them", () => {
    const { controller, animations, animationFocus, presence } = createPanelHarness();
    animations.link("shared");
    const { document } = animations.set("shared")!;
    const clipId = document.addClip({ name: "Wave" })!;
    animationFocus.focusClip("shared", clipId);

    document.applyRemote({ action: "clip-removed", id: clipId }, "bob");
    assert.equal(controller.state.notice, "A peer deleted the clip you had open.");

    presence.peers = [{ clientId: "bob", displayName: "Bob", color: "#ff0000" }];
    assert.equal(controller.state.notice, "Bob deleted the clip you had open.");
  });

  test("keys the selected block, and nothing without a selection", () => {
    const { controller, selection, keyed } = createPanelHarness();

    controller.keySelected();
    selection.select("arm");
    controller.keySelected();

    assert.deepEqual(keyed, ["arm"]);
  });

  test("titles the key button with the chord the user bound", () => {
    const { controller, keyBindings } = createPanelHarness();
    assert.equal(controller.state.keyTitle, "Key selected block (K)");

    keyBindings.assign("animation.key", ["j"]);
    assert.equal(controller.state.keyTitle, "Key selected block (J)");

    keyBindings.assign("animation.key", []);
    assert.equal(controller.state.keyTitle, "Key selected block");
  });

  test("a new clip of the model goes to its own set, even with a shared set focused", async() => {
    const { controller, animations, pick, names } = createPanelHarness();
    controller.actions!.linkSet(MENU_POINT);
    await pick("Humanoid");
    names.push("Idle");

    await controller.actions!.newClip(null);

    const { set, clip, ownClips, sharedSets, canShare } = controller.state;
    assert.equal(set?.id, animations.ownSet()?.id);
    assert.equal(clip?.clip.name, "Idle");
    assert.deepEqual(clipLabels(ownClips), ["Idle"]);
    assert.deepEqual(sharedSets[0].children, []);
    assert.equal(canShare, true);
  });

  test("a new clip in a shared set goes there, picked from the set menu", async() => {
    const { controller, animationFocus, pick, prompts } = createPanelHarness();
    controller.actions!.linkSet(MENU_POINT);
    await pick("Humanoid");

    controller.actions!.newSharedClip(MENU_POINT);
    await pick("In Humanoid");

    const { set, clip, sharedSets, ownClips } = controller.state;
    assert.equal(prompts.at(-1)?.heading, "New Clip in Humanoid");
    assert.equal(set?.id, "shared");
    assert.deepEqual(animationFocus.focus, { setId: "shared", clipId: clip?.clip.id });
    assert.deepEqual(
      sharedSets[0].children?.map(({ label, detail }) => [label, detail]),
      [["Clip 1", "1.0s"]]
    );
    assert.deepEqual(ownClips, []);
  });

  test("refuses a clip name its target already has, ignoring case and spaces", async() => {
    const { controller, prompts, names } = createPanelHarness();
    names.push("Walk");
    await controller.actions!.newClip(null);

    await controller.actions!.newClip(null);
    const [, second] = prompts;

    assert.equal(second.defaultName, "Clip 1");
    assert.equal(second.validate?.(" walk "), "A clip named \"walk\" already exists in this model");
    assert.equal(second.validate?.("Run"), null);
  });

  test("an inline rename refuses a name another clip of its set has", async() => {
    const { controller, names } = createPanelHarness();
    names.push("Walk", "Run");
    await controller.actions!.newClip(null);
    await controller.actions!.newClip(null);
    const [walk, run] = controller.state.ownClips;

    assert.match(controller.validateRename({ id: run.id, name: "WALK" }) ?? "", /already exists/);
    assert.equal(controller.validateRename({ id: walk.id, name: "walk" }), null);
  });

  test("deleting the focused clip asks first and keeps the model's own set", async() => {
    const { controller, deletes, animations } = createPanelHarness();
    await controller.actions!.newClip(null);

    await controller.deleteFocused();

    assert.deepEqual(deletes, ["Delete Clip"]);
    assert.equal(controller.state.set, null);
    assert.equal(animations.ownSet()?.document.set.size, 0);
    assert.equal(controller.state.canShare, false);
  });

  test("unlinks a shared set from its row menu", async() => {
    const { controller, animations, pick, rowAction } = createPanelHarness();
    controller.actions!.linkSet(MENU_POINT);
    await pick("Humanoid");

    await rowAction("Humanoid", "Unlink from this model");

    assert.deepEqual(animations.sets(), []);
    assert.equal(controller.state.set, null);
  });

  test("shares the own clips as a named set", async() => {
    const { controller, names } = createPanelHarness();
    await controller.actions!.newClip(null);
    names.push("Run");

    await controller.actions!.shareOwnSet();

    const { ownClips, sharedSets, canShare } = controller.state;
    assert.deepEqual(ownClips, []);
    assert.deepEqual(sharedSets.map(({ label, children }) => [label, children?.length]), [["Run", 1]]);
    assert.equal(canShare, false);
  });

  test("changes the length in frames and keeps the duration when the fps changes", async() => {
    const { controller } = createPanelHarness();
    await controller.actions!.newClip(null);

    controller.changeFrames(48);
    assert.equal(controller.state.clip?.frames, 48);

    controller.changeClip({ fps: 12 });
    assert.equal(controller.state.clip?.frames, 24);
  });

  test("files clip settings in the clip's history, not its set's", async() => {
    const { controller, history } = createPanelHarness();
    await controller.actions!.newClip(null);
    const { setId, clip } = controller.state.clip!;
    const clipScope = animationKey(setId, clip.id);
    const setSteps = history.state(ANIMATION_LIBRARY).undoCount;

    controller.changeClip({ loop: !clip.loop });

    assert.equal(history.state(clipScope).undoCount, 1);
    assert.equal(history.state(ANIMATION_LIBRARY).undoCount, setSteps);
    assert.equal(history.undo(clipScope), true);
    assert.equal(controller.state.clip?.clip.loop, clip.loop);
  });

  test("creates a set from the name the user gives", async() => {
    const { controller, names } = createPanelHarness();
    names.push("Run");

    await controller.actions!.newSet();

    assert.equal(controller.state.set?.name, "Run");
  });

  test("reports a set that could not be created, until one is", async() => {
    const source = createSetSource();
    const create = source.create;
    source.create = () => Promise.reject(new Error("disk full"));
    const { controller, names } = createPanelHarness(source);
    names.push("Run", "Run");

    await controller.actions!.newSet();
    assert.equal(controller.state.error, "Could not create \"Run\": disk full");
    assert.equal(controller.state.set, null);

    source.create = create;
    await controller.actions!.newSet();
    assert.equal(controller.state.error, null);
  });
});
