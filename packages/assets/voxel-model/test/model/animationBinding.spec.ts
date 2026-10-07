// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { ModelDocument } from "#src/model/ModelDocument.ts";
import {
  bindTracks,
  blockPathOf,
  boundBlocks,
  type TrackBinding,
  poseBlock,
  poseDelta,
  trackPathOf
} from "#src/model/animationBinding.ts";
import { createBlockTransform } from "#src/model/blockTransform.ts";
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

describe("bindTracks", () => {
  test("binds by name path, ignoring case and spaces, and reports what does not bind", () => {
    const { tree, ids } = createModel();

    const binding = bindTracks(
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
    assert.deepEqual(boundBlocks(binding), new Map([["body/ARM.L/hand ", ids.hand], ["Body", ids.body]]));
  });

  test("resolves a remap by its target path, ignores one to nothing, and reports a missing target", () => {
    const { tree, ids } = createModel();

    const binding = bindTracks(
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
    assert.equal(bindTracks(["Rig/Foot"], remapped, document.tree).get("Rig/Foot")?.state, "missing");

    const paw = document.addBlock({ name: "Paw", parentId: body })!;

    assert.equal(bindTracks(["Rig/Foot"], remapped, document.tree).get("Rig/Foot")?.blockId, paw);
  });
});

describe("poseBlock", () => {
  test("adds position, adds rotation in degrees, multiplies scale, and keeps the rest", () => {
    const rest = createBlockTransform({
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: Math.PI, z: 0 },
      scale: { x: 2, y: 2, z: 2 },
      size: { x: 4, y: 1, z: 1 }
    });

    const posed = poseBlock(rest, {
      position: { x: 1, y: 0, z: -1 },
      rotation: { x: 90, y: -180, z: 0 },
      scale: { x: 0.5, y: 1, z: 2 }
    });

    assert.deepEqual(posed.position, { x: 2, y: 2, z: 2 });
    assert.deepEqual(posed.rotation, { x: Math.PI / 2, y: 0, z: 0 });
    assert.deepEqual(posed.scale, { x: 1, y: 2, z: 4 });
    assert.deepEqual(posed.size, rest.size);
    assert.deepEqual(poseBlock(rest, {}), rest);
  });
});

describe("poseDelta", () => {
  test("is the sample that poses the rest transform into the pose", () => {
    const rest = createBlockTransform({
      position: { x: 1, y: 2, z: 3 },
      scale: { x: 2, y: 0, z: 2 }
    });
    const sample = {
      position: { x: 1, y: 0, z: -1 },
      rotation: { x: 90, y: 0, z: 0 },
      scale: { x: 0.5, y: 1, z: 2 }
    };

    assert.deepEqual(poseDelta(rest, poseBlock(rest, sample)), sample);
    assert.deepEqual(poseDelta(rest, rest), {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    });
  });
});

describe("trackPathOf", () => {
  test("prefers a track bound to the block, then one remapped to its path, then its name path", () => {
    const { tree, ids } = createModel();
    const remapped = link([{ path: "Rig/Wrist", target: "body/arm.l/hand" }]);

    assert.equal(trackPathOf(link(), tree, ids.hand), "Body/Arm.L/Hand");
    assert.equal(trackPathOf(link(), tree, ids.hand, ["Body", "body/arm.l/HAND"]), "body/arm.l/HAND");
    assert.equal(trackPathOf(remapped, tree, ids.hand), "Rig/Wrist");
  });
});
