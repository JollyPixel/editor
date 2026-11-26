// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  ComponentChange,
  SceneDocument
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import { ActorWrites } from "../../src/editing/ActorWrites.ts";
import { SceneDraft } from "../../src/state/SceneDraft.ts";
import {
  createProbeBinding,
  type Probe
} from "../helpers/probeComponents.ts";
import { sceneAccess } from "../helpers/sceneAccess.ts";

function createDraft(
  document: SceneDocument
) {
  const { binding } = createProbeBinding(document);
  const draft = new SceneDraft({
    document,
    view: binding,
    writes: new ActorWrites(document, sceneAccess())
  });

  return {
    binding,
    draft
  };
}

describe("SceneDraft", () => {
  test("keeps a transform edit while other actors change and drops it when its own actor changes", () => {
    const document = new SceneDocument();
    const actorId = document.addActor({ name: "Actor" })!;
    const otherId = document.addActor({ name: "Other" })!;
    const { binding, draft } = createDraft(document);
    const { transform } = binding.actor(actorId)!;
    let changes = 0;
    draft.subscribe("change", () => {
      changes++;
    });

    draft.editTransform(actorId, { position: { x: 5, y: 0, z: 0 } });
    document.transform(otherId, { position: { x: 1, y: 1, z: 1 } });
    assert.strictEqual(changes, 1);
    assert.deepEqual(draft.transform(document.tree.actor(actorId)!).position, { x: 5, y: 0, z: 0 });
    assert.deepEqual(transform.local.position, { x: 5, y: 0, z: 0 });
    assert.deepEqual(document.tree.actor(actorId)!.transform.position, { x: 0, y: 0, z: 0 });

    document.transform(actorId, { position: { x: 2, y: 0, z: 0 } });
    assert.deepEqual(draft.transform(document.tree.actor(actorId)!).position, { x: 2, y: 0, z: 0 });
    assert.deepEqual(transform.local.position, { x: 2, y: 0, z: 0 });
  });

  test("previews a transform edit over the stored transform and restores it on discard", () => {
    const document = new SceneDocument();
    const actorId = document.addActor({ name: "Actor", transform: { scale: { x: 2, y: 2, z: 2 } } })!;
    const { binding, draft } = createDraft(document);
    const { transform } = binding.actor(actorId)!;
    let changes = 0;
    draft.subscribe("change", () => {
      changes++;
    });

    draft.editTransform(actorId, { position: { x: 5, y: 0, z: 0 } });
    assert.deepEqual(transform.local.position, { x: 5, y: 0, z: 0 });
    assert.deepEqual(transform.local.scale, { x: 2, y: 2, z: 2 });

    draft.discardTransform(actorId);
    draft.discardTransform(actorId);

    assert.strictEqual(changes, 2);
    assert.deepEqual(draft.transform(document.tree.actor(actorId)!).position, { x: 0, y: 0, z: 0 });
    assert.deepEqual(transform.local.position, { x: 0, y: 0, z: 0 });
    assert.deepEqual(document.tree.actor(actorId)!.transform.position, { x: 0, y: 0, z: 0 });
  });

  test("previews a component edit only through apply and restores the viewport on a refused commit", () => {
    const document = new SceneDocument();
    document.addActor({
      name: "Actor",
      components: [
        { id: "probe", type: "Patched", data: { label: "a" }, assets: {} },
        { id: "rebuilt", type: "Rebuilt", data: { label: "a" }, assets: {} }
      ]
    });
    const { binding, draft } = createDraft(document);
    const probe = binding.component("probe") as Probe;
    const rebuilt = binding.component("rebuilt") as Probe;
    function stored() {
      return document.tree.component("probe")!;
    }

    draft.editComponent("probe", new ComponentChange({ data: { label: "b" } }));
    draft.editComponent("rebuilt", new ComponentChange({ data: { label: "b" } }));
    assert.strictEqual(probe.label, "b");
    assert.strictEqual(binding.component("rebuilt"), rebuilt);
    assert.strictEqual(rebuilt.label, "a");
    assert.deepEqual(stored().data, { label: "a" });
    assert.deepEqual(draft.component(stored()).data, { label: "b" });

    draft.commitComponent("probe", ComponentChange.NONE);
    assert.strictEqual(probe.label, "a");
    assert.deepEqual(draft.component(stored()).data, { label: "a" });

    draft.editComponent("probe", new ComponentChange({ data: { label: "c" } }));
    draft.commitComponent("probe", new ComponentChange({ data: { label: "c" } }));
    assert.deepEqual(stored().data, { label: "c" });
    assert.deepEqual(draft.component(stored()).data, { label: "c" });
  });
});
