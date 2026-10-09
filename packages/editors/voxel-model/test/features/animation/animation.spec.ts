// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  JollyReparentDetail,
  TreeDropWhere
} from "@jolly-pixel/ui";
import { AnimationDocument } from "@jolly-pixel/asset.voxel-animation/client";
import { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  AnimationLibrary,
  type AnimationSetRecord,
  type AnimationSetSource
} from "#src/features/animation/library/AnimationLibrary.ts";
import { AnimatePanelController } from "#src/features/animation/AnimatePanelController.ts";
import {
  AnimationFocusStore,
  AnimationPlaybackStore,
  BlockSelectionStore,
  PresenceStore,
  TabStore,
  animationKey
} from "#src/state/index.ts";
import { AnimationSession } from "#src/features/animation/session/AnimationSession.ts";
import { setName } from "#src/boot/animationSetSource.ts";
import { AnimationHistories } from "#src/features/animation/undo/AnimationHistories.ts";
import { ClipRemovalFocus } from "#src/features/animation/library/ClipRemovalFocus.ts";
import {
  ANIMATION_LIBRARY,
  createEditorHistory
} from "#src/features/history/index.ts";
import type { NameDialogContext } from "#src/shared/dialogs/NameDialog.ts";
import { MenuSession } from "#src/shared/menu/MenuSession.ts";
import { createHost } from "./fixtures.ts";

// CONSTANTS
const kPoint = { x: 0, y: 0 };

interface FakeSource extends AnimationSetSource {
  opened: string[];
  released: string[];
  documents: Map<string, AnimationDocument>;
  notify(): void;
}

function createSource(
  records: AnimationSetRecord[] = []
): FakeSource {
  const listeners = new Set<() => void>();
  const source: FakeSource = {
    opened: [],
    released: [],
    documents: new Map(),
    open(id) {
      source.opened.push(id);
      const document = source.documents.get(id) ?? new AnimationDocument();
      source.documents.set(id, document);

      return {
        document,
        release: () => source.released.push(id)
      };
    },
    create(name) {
      const record = { id: `set-${records.length + 1}`, kind: "voxelanimation", name };
      records.push(record);

      return Promise.resolve({ id: record.id, kind: record.kind });
    },
    createOwn: () => source.create("Robot"),
    rename(id, name) {
      const record = records.find((candidate) => candidate.id === id);
      if (record !== undefined) {
        record.name = name;
      }

      return Promise.resolve();
    },
    records: () => [...records],
    usersOf: (id) => (id === "shared" ? 3 : 1),
    subscribe(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    notify() {
      for (const listener of listeners) {
        listener();
      }
    }
  };

  return source;
}

function createLibrary(
  document: ModelDocument,
  source: AnimationSetSource
): AnimationLibrary {
  return new AnimationLibrary({ document, source });
}

describe("AnimationLibrary", () => {
  test("opens a set when linked and releases it when unlinked", () => {
    const document = new ModelDocument();
    const source = createSource([{ id: "shared", kind: "voxelanimation", name: "Humanoid" }]);
    const library = createLibrary(document, source);

    assert.equal(library.link("shared"), true);
    assert.deepEqual(source.opened, ["shared"]);
    assert.deepEqual(
      library.sets().map(({ id, name, users }) => [id, name, users]),
      [["shared", "Humanoid", 3]]
    );
    assert.deepEqual(library.linkable(), []);

    library.unlink("shared");
    assert.deepEqual(source.released, ["shared"]);
    assert.deepEqual(library.sets(), []);
  });

  test("creates a set asset and links it", async() => {
    const document = new ModelDocument();
    const library = createLibrary(document, createSource());

    const id = await library.create("Walk");

    assert.deepEqual(
      [...document.tree.animationSets.values()],
      [{ id, kind: "voxelanimation", bindings: [] }]
    );
    assert.equal(library.set(id)?.name, "Walk");
  });

  test("creates the model's own set once, even when asked twice at the same time", async() => {
    const document = new ModelDocument();
    const library = createLibrary(document, createSource());

    const [first, second] = await Promise.all([library.ensureOwnSet(), library.ensureOwnSet()]);

    assert.equal(first, second);
    assert.deepEqual(document.tree.animationSets.owned, {
      id: first,
      kind: "voxelanimation",
      bindings: [],
      own: true
    });
    assert.equal(library.ownSet()?.name, "Robot");
    assert.equal(await library.ensureOwnSet(), first);
  });

  test("a first clip of the model is one library undo step, which keeps the own set linked", async() => {
    const document = new ModelDocument();
    const history = createEditorHistory({ document });
    const library = new AnimationLibrary({ document, source: createSource() });
    new AnimationHistories({
      history,
      document,
      animations: library
    });

    const ref = await library.addClip(null, "Walk");

    assert.equal(history.state(ANIMATION_LIBRARY).undoCount, 1);
    assert.equal(history.undo(ANIMATION_LIBRARY), true);
    assert.equal(library.ownSet()?.id, ref?.setId);
    assert.equal(library.ownSet()?.document.set.size, 0);
    assert.equal(history.state(ANIMATION_LIBRARY).canUndo, false);
  });

  test("shares the own set under a new name", async() => {
    const document = new ModelDocument();
    const library = createLibrary(document, createSource());
    const id = await library.ensureOwnSet();

    await library.share(id, "Humanoid");

    assert.equal(library.ownSet(), undefined);
    assert.deepEqual(library.sets().map(({ name, own }) => [name, own]), [["Humanoid", false]]);
  });

  test("tells listeners when a set or the catalog changes, and stops on dispose", () => {
    const document = new ModelDocument();
    const source = createSource([{ id: "shared", kind: "voxelanimation", name: "Humanoid" }]);
    const library = createLibrary(document, source);
    library.link("shared");
    let changes = 0;
    library.on("change", () => changes++);

    source.documents.get("shared")!.addClip({ name: "Idle" });
    source.notify();
    assert.equal(changes, 2);

    library.dispose();
    assert.deepEqual(source.released, ["shared"]);
    source.notify();
    assert.equal(changes, 2);
  });
});

describe("AnimatePanelController", () => {
  function createHarness(
    source = createSource([{ id: "shared", kind: "voxelanimation", name: "Humanoid" }])
  ) {
    const document = new ModelDocument();
    const history = createEditorHistory({ document });
    const animations = new AnimationLibrary({ document, source });
    const animationFocus = new AnimationFocusStore();
    new AnimationHistories({
      history,
      document,
      animations
    });
    const presence = new PresenceStore();
    const clipRemoval = new ClipRemovalFocus({ animations, animationFocus, presence });
    const deletes: string[] = [];
    const prompts: NameDialogContext[] = [];
    const names: string[] = [];
    let menu = MenuSession.EMPTY;
    const controller = new AnimatePanelController(createHost(), {
      promptName: (context) => {
        prompts.push(context);

        return Promise.resolve({ name: names.shift() ?? context.defaultName });
      },
      promptDelete: (context) => {
        deletes.push(context.heading);

        return Promise.resolve({ deleteChildren: false });
      },
      openMenu: (session) => {
        menu = session;
      },
      beginRename: () => undefined
    });
    const keyed: string[] = [];
    const selection = new BlockSelectionStore();
    const animationSession = new AnimationSession({
      document,
      animations,
      animationFocus,
      animationPlayback: new AnimationPlaybackStore(),
      tab: new TabStore()
    });
    controller.attach({
      animations,
      animationFocus,
      selection,
      presence,
      clipRemoval,
      keyer: {
        keyBlock: (id) => keyed.push(id) > 0
      }
    });

    async function pick(
      label: string
    ): Promise<void> {
      const item = menu.items.find((entry) => entry !== "separator" && entry.label === label);
      assert.ok(item !== undefined && item !== "separator", `no "${label}" in the menu`);
      await menu.run(item.id, kPoint);
    }

    async function rowAction(
      rowLabel: string,
      label: string,
      setId?: string
    ): Promise<void> {
      const { ownClips, sharedSets } = controller.state;
      const rows = [...ownClips, ...sharedSets, ...sharedSets.flatMap(({ children }) => children ?? [])];
      const row = rows.find((candidate) => candidate.label === rowLabel &&
        (setId === undefined || candidate.data?.setId === setId));
      assert.ok(row !== undefined, `no "${rowLabel}" row`);
      menu = controller.rowMenu(row.id);
      await pick(label);
    }

    return {
      controller,
      animations,
      history,
      animationFocus,
      animationSession,
      deletes,
      selection,
      presence,
      keyed,
      prompts,
      names,
      pick,
      rowAction
    };
  }

  test("badges a clip row with the peers who have it open", () => {
    const { controller, animations, presence } = createHarness();
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
    const { controller, animations, animationFocus, presence } = createHarness();
    animations.link("shared");
    const { document } = animations.set("shared")!;
    const clipId = document.addClip({ name: "Wave" })!;
    animationFocus.focusClip("shared", clipId);
    presence.peers = [{ clientId: "bob", displayName: "Bob", color: "#ff0000" }];

    document.apply({ action: "clip-removed", id: clipId }, "bob");

    assert.deepEqual(animationFocus.focus, { setId: "shared", clipId: null });
    assert.equal(controller.state.notice, "Bob deleted the clip you had open.");

    controller.handleSelect(new CustomEvent("jolly-select", {
      detail: { selected: [animationKey("shared")] }
    }));
    assert.equal(controller.state.notice, null, "picking the set it fell back to clears the notice");

    document.addClip({ id: "again", name: "Again" });
    animationFocus.focusClip("shared", "again");
    document.apply({ action: "clip-removed", id: "again" }, "bob");
    animationFocus.focusSet(null);
    assert.equal(controller.state.notice, null);

    animationFocus.focusSet("shared");
    assert.equal(controller.state.notice, null, "coming back to the set does not bring the notice back");
  });

  test("names the peer who deleted the open clip once the roster knows them", () => {
    const { controller, animations, animationFocus, presence } = createHarness();
    animations.link("shared");
    const { document } = animations.set("shared")!;
    const clipId = document.addClip({ name: "Wave" })!;
    animationFocus.focusClip("shared", clipId);

    document.apply({ action: "clip-removed", id: clipId }, "bob");
    assert.equal(controller.state.notice, "A peer deleted the clip you had open.");

    presence.peers = [{ clientId: "bob", displayName: "Bob", color: "#ff0000" }];
    assert.equal(controller.state.notice, "Bob deleted the clip you had open.");
  });

  function clipLabels(
    nodes: readonly { label: string; }[]
  ): string[] {
    return nodes.map(({ label }) => label);
  }

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

  test("keys the selected block, and nothing without a selection", () => {
    const { controller, selection, keyed } = createHarness();

    controller.keySelected();
    selection.select("arm");
    controller.keySelected();

    assert.deepEqual(keyed, ["arm"]);
  });

  test("a new clip of the model goes to its own set, even with a shared set focused", async() => {
    const { controller, animations, pick, names } = createHarness();
    controller.actions!.linkSet(kPoint);
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
    const { controller, animationFocus, pick, prompts } = createHarness();
    controller.actions!.linkSet(kPoint);
    await pick("Humanoid");

    controller.actions!.newSharedClip(kPoint);
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
    const { controller, prompts, names } = createHarness();
    names.push("Walk");
    await controller.actions!.newClip(null);

    await controller.actions!.newClip(null);
    const [, second] = prompts;

    assert.equal(second.defaultName, "Clip 1");
    assert.equal(second.validate?.(" walk "), "A clip named \"walk\" already exists in this model");
    assert.equal(second.validate?.("Run"), null);
  });

  test("an inline rename refuses a name another clip of its set has", async() => {
    const { controller, names } = createHarness();
    names.push("Walk", "Run");
    await controller.actions!.newClip(null);
    await controller.actions!.newClip(null);
    const [walk, run] = controller.state.ownClips;

    assert.match(controller.validateRename({ id: run.id, name: "WALK" }) ?? "", /already exists/);
    assert.equal(controller.validateRename({ id: walk.id, name: "walk" }), null);
  });

  test("copies a clip of the model to a shared set, keys included, and keeps the original", async() => {
    const { controller, animations, pick, names, rowAction } = createHarness();
    controller.actions!.linkSet(kPoint);
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
    const source = createSource([{ id: "shared", kind: "voxelanimation", name: "Humanoid" }]);
    const shared = new AnimationDocument();
    shared.addClip({ id: "walk", name: "Walk" });
    source.documents.set("shared", shared);
    const { controller, pick, names, prompts, rowAction } = createHarness(source);
    controller.actions!.linkSet(kPoint);
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
    const { controller, names, rowAction } = createHarness();
    names.push("Walk", "Run");
    await controller.actions!.newClip(null);
    await controller.actions!.newClip(null);

    await rowAction("Walk", "Duplicate");
    await rowAction("Walk", "Duplicate");

    assert.deepEqual(clipLabels(controller.state.ownClips), ["Walk", "Walk Copy 2", "Walk Copy", "Run"]);
  });

  test("a dropped clip reorders its own set, and never lands in another set", async() => {
    const source = createSource([
      { id: "shared", kind: "voxelanimation", name: "Humanoid" },
      { id: "props", kind: "voxelanimation", name: "Props" }
    ]);
    const { controller, animations, names } = createHarness(source);
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
    const { controller } = createHarness();
    await controller.actions!.newClip(null);
    const [row] = controller.state.ownClips;

    const items = controller.rowMenu(row.id).items.filter((entry) => entry !== "separator");

    assert.deepEqual(
      items.map(({ label, disabled = false }) => [label, disabled]),
      [["Rename", false], ["Duplicate", false], ["Copy to…", true], ["Delete", false]]
    );
  });

  test("deleting the focused clip asks first and keeps the model's own set", async() => {
    const { controller, deletes, animations } = createHarness();
    await controller.actions!.newClip(null);

    await controller.deleteFocused();

    assert.deepEqual(deletes, ["Delete Clip"]);
    assert.equal(controller.state.set, null);
    assert.equal(animations.ownSet()?.document.set.size, 0);
    assert.equal(controller.state.canShare, false);
  });

  test("unlinks a shared set from its row menu", async() => {
    const { controller, animations, pick, rowAction } = createHarness();
    controller.actions!.linkSet(kPoint);
    await pick("Humanoid");

    await rowAction("Humanoid", "Unlink from this model");

    assert.deepEqual(animations.sets(), []);
    assert.equal(controller.state.set, null);
  });

  test("shares the own clips as a named set", async() => {
    const { controller, names } = createHarness();
    await controller.actions!.newClip(null);
    names.push("Run");

    await controller.actions!.shareOwnSet();

    const { ownClips, sharedSets, canShare } = controller.state;
    assert.deepEqual(ownClips, []);
    assert.deepEqual(sharedSets.map(({ label, children }) => [label, children?.length]), [["Run", 1]]);
    assert.equal(canShare, false);
  });

  test("changes the length in frames and keeps the duration when the fps changes", async() => {
    const { controller } = createHarness();
    await controller.actions!.newClip(null);

    controller.changeFrames(48);
    assert.equal(controller.state.clip?.frames, 48);

    controller.changeClip({ fps: 12 });
    assert.equal(controller.state.clip?.frames, 24);
  });

  test("files clip settings in the clip's history, not its set's", async() => {
    const { controller, history } = createHarness();
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
    const { controller, names } = createHarness();
    names.push("Run");

    await controller.actions!.newSet();

    assert.equal(controller.state.set?.name, "Run");
  });

  test("reports a set that could not be created, until one is", async() => {
    const source = createSource();
    const create = source.create;
    source.create = () => Promise.reject(new Error("disk full"));
    const { controller, names } = createHarness(source);
    names.push("Run", "Run");

    await controller.actions!.newSet();
    assert.equal(controller.state.error, "Could not create \"Run\": disk full");
    assert.equal(controller.state.set, null);

    source.create = create;
    await controller.actions!.newSet();
    assert.equal(controller.state.error, null);
  });
});

describe("setName", () => {
  test("keeps the file name without folders or extension", () => {
    assert.equal(setName("animations/Humanoid Walk.voxelanim.json"), "Humanoid Walk");
    assert.equal(setName("odd.txt"), "odd.txt");
  });
});
