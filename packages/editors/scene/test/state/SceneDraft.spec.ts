// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  createSceneEnvironment,
  SceneDocument
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import { SceneDraft } from "../../src/state/SceneDraft.ts";
import {
  createProbeBinding,
  type Probe
} from "../helpers/probeComponents.ts";

function createDraft(
  document: SceneDocument
) {
  const { binding } = createProbeBinding(document);
  const draft = new SceneDraft({
    document,
    view: binding
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
    const { object3D } = binding.actor(actorId)!;
    let changes = 0;
    draft.subscribe("change", () => {
      changes++;
    });

    draft.editTransform(actorId, { position: { x: 5, y: 0, z: 0 } });
    document.transform(otherId, { position: { x: 1, y: 1, z: 1 } });
    assert.strictEqual(changes, 1);
    assert.deepEqual(draft.transform(document.tree.actor(actorId)!).position, { x: 5, y: 0, z: 0 });
    assert.deepEqual(object3D.position.toArray(), [5, 0, 0]);
    assert.deepEqual(document.tree.actor(actorId)!.transform.position, { x: 0, y: 0, z: 0 });

    document.transform(actorId, { position: { x: 2, y: 0, z: 0 } });
    assert.deepEqual(draft.transform(document.tree.actor(actorId)!).position, { x: 2, y: 0, z: 0 });
    assert.deepEqual(object3D.position.toArray(), [2, 0, 0]);
  });

  test("commits a component edit and restores the viewport when the document refuses the commit", () => {
    const document = new SceneDocument();
    document.addActor({
      name: "Actor",
      components: [{ id: "probe", type: "Patched", data: { label: "a" }, assets: {} }]
    });
    const { binding, draft } = createDraft(document);
    const probe = binding.component("probe") as Probe;
    function stored() {
      return document.tree.component("probe")!;
    }

    draft.editComponent("probe", { data: { label: "b" } });
    assert.strictEqual(probe.label, "b");
    assert.deepEqual(draft.component(stored()).data, { label: "b" });

    draft.commitComponent("probe", {});
    assert.strictEqual(probe.label, "a");
    assert.deepEqual(draft.component(stored()).data, { label: "a" });

    draft.editComponent("probe", { data: { label: "c" } });
    draft.commitComponent("probe", { data: { label: "c" } });
    assert.deepEqual(stored().data, { label: "c" });
    assert.deepEqual(draft.component(stored()).data, { label: "c" });
  });

  test("discards every edit when the document resets", () => {
    const document = new SceneDocument();
    const { draft } = createDraft(document);

    draft.editEnvironment({ background: "#ff0000" });
    document.load({
      environment: createSceneEnvironment(),
      actors: []
    });

    assert.deepEqual(draft.environment(), document.tree.environment);
  });
});
