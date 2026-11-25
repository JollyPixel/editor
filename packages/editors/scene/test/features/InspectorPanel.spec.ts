// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { SceneDocument } from "@jolly-pixel/asset.scene/client";
import type {
  Button,
  Text
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import "../../src/features/inspector/InspectorPanel.ts";
import { ActorWrites } from "../../src/editing/ActorWrites.ts";
import { InstanceOverrides } from "../../src/editing/InstanceOverrides.ts";
import type { SceneEditing } from "../../src/editing/SceneEditing.ts";
import { createSceneHistory } from "../../src/features/history/sceneHistory.ts";
import { SceneDraft } from "../../src/state/SceneDraft.ts";
import { SelectionStore } from "../../src/state/SelectionStore.ts";
import { createPrefabScenes } from "../helpers/prefabScenes.ts";
import { createProbeBinding } from "../helpers/probeComponents.ts";
import { sceneAccess } from "../helpers/sceneAccess.ts";

async function inspectOverriddenInstance() {
  const house = new SceneDocument();
  const doorId = house.addActor({ name: "Door" })!;
  const level = new SceneDocument();
  const instanceId = level.addActor({
    name: "House",
    prefab: {
      id: "house",
      kind: "scene"
    }
  })!;
  const houseAccess = sceneAccess();
  const { scenes } = createPrefabScenes({ house }, { house: houseAccess });
  const { binding } = createProbeBinding(level, scenes);
  const access = sceneAccess();
  const writes = new ActorWrites(level, access);
  writes.rename(`${instanceId}/${doorId}`, "Front door");
  const selection = new SelectionStore(level, binding);
  selection.select([instanceId]);
  const editing = {
    document: level,
    live: binding,
    selection,
    access,
    writes,
    overrides: new InstanceOverrides({
      document: level,
      history: createSceneHistory(level),
      live: binding,
      prefabs: scenes,
      access
    }),
    draft: new SceneDraft({
      document: level,
      view: binding,
      writes
    }),
    assetSlots: {
      name: () => "House",
      subscribe: () => () => undefined
    }
  };
  const inspector = document.createElement("jolly-scene-inspector");
  document.body.append(inspector);
  inspector.attach(editing as unknown as SceneEditing);
  await inspector.updateComplete;

  return {
    access,
    houseAccess,
    inspector,
    query<TElement extends Element>(
      selector: string
    ): TElement {
      return inspector.shadowRoot!.querySelector<TElement>(selector)!;
    }
  };
}

describe("InspectorPanel", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("a viewer sees the actor fields read-only", async() => {
    const { access, inspector, query } = await inspectOverriddenInstance();
    const name = query<Text>("jolly-text[label=\"Name\"]");
    const before = name.readonly;

    access.viewOnly();
    await inspector.updateComplete;

    assert.deepEqual([before, name.readonly], [false, true]);
  });

  test("Apply to prefab turns off as soon as the prefab scene refuses an override", async() => {
    const { houseAccess, inspector, query } = await inspectOverriddenInstance();
    const apply = query<Button>("jolly-button[label=\"Apply overrides to prefab\"]");
    const before = apply.disabled;

    houseAccess.withhold("hierarchy");
    await inspector.updateComplete;

    assert.deepEqual([before, apply.disabled], [false, true]);
  });
});
