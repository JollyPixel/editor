// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ModelDocument } from "#src/model/ModelDocument.ts";
import {
  TrackBinding,
  blockPathOf
} from "#src/model/animation/TrackBinding.ts";
import type { AnimationSetLinkJSON } from "#src/network/types.ts";

function createModel() {
  const document = new ModelDocument();
  const body = document.addBlock({ name: "Body" })!;
  const limbs = document.addFolder({ name: "Limbs", parentId: body })!;
  const arm = document.addBlock({ name: "Arm.L", parentId: limbs })!;
  const hand = document.addBlock({ name: "Hand", parentId: arm })!;
  const first = document.addBlock({ name: "Leg", parentId: body })!;
  const second = document.addBlock({ name: "Leg", parentId: limbs })!;

  return {
    tree: document.tree,
    ids: { body, arm, hand, first, second }
  };
}

function link(
  bindings: AnimationSetLinkJSON["bindings"] = []
): AnimationSetLinkJSON {
  return {
    id: "walk",
    kind: "voxelanimation",
    bindings
  };
}

describe("blockPathOf", () => {
  test("joins block names from the root, skipping folders", () => {
    const { tree, ids } = createModel();

    assert.equal(blockPathOf(tree, ids.body), "Body");
    assert.equal(blockPathOf(tree, ids.hand), "Body/Arm.L/Hand");
  });
});

function statesOf(
  binding: TrackBinding
): [string, string, string | null][] {
  return [...binding].map(([path, { state, blockId }]) => [path, state, blockId]);
}

describe("TrackBinding", () => {
  test("binds by name path, ignoring case and spaces, and reports what does not bind", () => {
    const { tree, ids } = createModel();

    const binding = new TrackBinding(
      ["body/ARM.L/hand ", "Body", "Body/Tail", "Body/Leg"],
      link(),
      tree
    );

    assert.deepEqual(statesOf(binding), [
      ["body/ARM.L/hand ", "bound", ids.hand],
      ["Body", "bound", ids.body],
      ["Body/Tail", "missing", null],
      ["Body/Leg", "ambiguous", null]
    ]);
    assert.deepEqual(binding.bound(), new Map([["body/ARM.L/hand ", ids.hand], ["Body", ids.body]]));
  });

  test("resolves a remap by its target path, ignores one to nothing, and reports a missing target", () => {
    const { tree, ids } = createModel();

    const binding = new TrackBinding(
      ["Body/Leg", "body", "Body/Tail"],
      link([
        { path: "body/leg", target: "Body/Arm.L/Hand" },
        { path: "Body", target: null },
        { path: "Body/Tail", target: "Body/Wing" }
      ]),
      tree
    );

    assert.deepEqual(statesOf(binding), [
      ["Body/Leg", "bound", ids.hand],
      ["body", "ignored", null],
      ["Body/Tail", "missing", null]
    ]);
    assert.deepEqual(binding.get("Body/Leg")?.remap, { path: "body/leg", target: "Body/Arm.L/Hand" });
  });

  test("a remap reconnects to a block deleted and made again under the same name", () => {
    const document = new ModelDocument();
    const body = document.addBlock({ name: "Body" })!;
    document.remove(document.addBlock({ name: "Paw", parentId: body })!);
    const remapped = link([{ path: "Rig/Foot", target: "Body/Paw" }]);
    assert.equal(new TrackBinding(["Rig/Foot"], remapped, document.tree).get("Rig/Foot")?.state, "missing");

    const paw = document.addBlock({ name: "Paw", parentId: body })!;

    assert.equal(new TrackBinding(["Rig/Foot"], remapped, document.tree).get("Rig/Foot")?.blockId, paw);
  });

  test("names a block by the track bound to it, then one remapped to its path, then its name path", () => {
    const { tree, ids } = createModel();
    const remapped = link([{ path: "Rig/Wrist", target: "body/arm.l/hand" }]);

    assert.equal(new TrackBinding([], link(), tree).pathOf(ids.hand), "Body/Arm.L/Hand");
    assert.equal(
      new TrackBinding(["Body", "body/arm.l/HAND"], link(), tree).pathOf(ids.hand),
      "body/arm.l/HAND"
    );
    assert.equal(new TrackBinding([], remapped, tree).pathOf(ids.hand), "Rig/Wrist");
  });
});
