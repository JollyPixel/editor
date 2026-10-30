// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import type { AssetReferenceData } from "@jolly-pixel/asset";
import { SceneDocument } from "@jolly-pixel/asset.scene/client";
import type {
  ContextMenuEntry,
  JollyToggleExpandDetail
} from "@jolly-pixel/ui";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { InstanceOverrides } from "../../src/editing/InstanceOverrides.ts";
import type {
  SceneAssetSlots,
  SceneEditing
} from "../../src/editing/SceneEditing.ts";
import { ActorTreeRows } from "../../src/features/hierarchy/ActorTreeRows.ts";
import { HierarchyController } from "../../src/features/hierarchy/HierarchyController.ts";
import { ActorPresetMenu } from "../../src/features/hierarchy/model/ActorPresetMenu.ts";
import { createSceneHistory } from "../../src/features/history/sceneHistory.ts";
import type { AnchorPicksEvents } from "../../src/state/AnchorPicks.ts";
import { PresenceStore } from "../../src/state/PresenceStore.ts";
import { SelectionStore } from "../../src/state/SelectionStore.ts";
import { createPrefabScenes } from "../helpers/prefabScenes.ts";
import {
  ANCHORED_COMPONENTS,
  createProbeBinding
} from "../helpers/probeComponents.ts";
import { createSceneComponents } from "../helpers/sceneComponents.ts";

// CONSTANTS
const kMap: AssetReferenceData = { id: "map-1", kind: "voxelmap" };
const kSpawn = { component: "map", key: "object:spawn" };
const kPoint = { x: 0, y: 0 };

type HierarchyEditing = Pick<
  SceneEditing,
  | "document"
  | "live"
  | "selection"
  | "anchorPicks"
  | "presence"
  | "components"
  | "presets"
  | "overrides"
  | "assetSlots"
>;

function createHierarchy(
  open: SceneAssetSlots["open"] = () => undefined,
  components = createSceneComponents(ANCHORED_COMPONENTS)
) {
  const document = new SceneDocument();
  const mapId = document.addActor({
    name: "Map",
    components: [{ id: "map", type: "Anchored", data: {}, assets: { map: kMap } }]
  })!;
  const { binding } = createProbeBinding(document);
  const anchorPicks = new Emitter<AnchorPicksEvents>();
  const editing: HierarchyEditing = {
    document,
    live: binding,
    selection: new SelectionStore(document, binding),
    anchorPicks,
    presence: new PresenceStore(),
    components,
    presets: new ActorPresetMenu(components),
    overrides: new InstanceOverrides({
      document,
      history: createSceneHistory(document),
      live: binding,
      prefabs: createPrefabScenes().scenes
    }),
    assetSlots: {
      name: () => "Overworld",
      pick: () => Promise.resolve(null),
      pickScene: () => Promise.resolve(null),
      open,
      subscribe: () => () => undefined
    }
  };
  const controllers: ReactiveController[] = [];
  const host: ReactiveControllerHost = {
    addController: (controller) => controllers.push(controller),
    removeController: () => undefined,
    requestUpdate: () => undefined,
    updateComplete: Promise.resolve(true)
  };
  const revealed: string[] = [];
  const hierarchy = new HierarchyController(host, {
    beginRename: () => undefined,
    reveal: (id) => revealed.push(id)
  });
  hierarchy.attach(editing as SceneEditing);
  for (const controller of controllers) {
    controller.hostConnected?.();
  }

  return {
    document,
    mapId,
    anchorPicks,
    hierarchy,
    revealed
  };
}

function showItem(
  items: readonly ContextMenuEntry[]
) {
  return items.find((item) => item !== "separator" && item.id === "show-in-asset");
}

describe("HierarchyController anchors", () => {
  test("shows an anchor in the asset that publishes it, at the anchor's key", async() => {
    const opened: Array<[AssetReferenceData, string | undefined]> = [];
    const { mapId, hierarchy } = createHierarchy(
      (reference, reveal) => opened.push([reference, reveal])
    );

    const menu = hierarchy.openMenu(ActorTreeRows.anchorRowId({ ownerId: mapId, anchor: kSpawn }));
    const show = showItem(menu.items);
    assert.ok(show !== undefined && show !== "separator");
    assert.strictEqual(show.label, "Show in Overworld");
    assert.notStrictEqual(show.disabled, true);

    await menu.run("show-in-asset", kPoint);

    assert.deepEqual(opened, [[kMap, "object:spawn"]]);
  });

  test("disables showing a lost anchor, and offers nothing without a shell or an anchor asset", () => {
    const gone = { component: "map", key: "object:gone" };
    const withShell = createHierarchy();
    withShell.document.addActor({ name: "Coin", parentId: withShell.mapId, anchor: gone });
    const withoutShell = createHierarchy(null);
    const withoutAnchorAsset = createHierarchy(
      () => undefined,
      createSceneComponents()
    );

    const missing = showItem(withShell.hierarchy.openMenu(
      ActorTreeRows.anchorRowId({ ownerId: withShell.mapId, anchor: gone })
    ).items);
    assert.ok(missing !== undefined && missing !== "separator");
    assert.strictEqual(missing.disabled, true);

    for (const { hierarchy, mapId } of [withoutShell, withoutAnchorAsset]) {
      assert.strictEqual(showItem(hierarchy.openMenu(
        ActorTreeRows.anchorRowId({ ownerId: mapId, anchor: kSpawn })
      ).items), undefined);
    }
  });

  test("expands the owner of a picked anchor and reveals its row", () => {
    const { mapId, anchorPicks, hierarchy, revealed } = createHierarchy();
    hierarchy.handleToggleExpand(new CustomEvent<JollyToggleExpandDetail>(
      "jolly-toggle-expand",
      { detail: { id: mapId, expanded: false } }
    ));
    assert.ok(!hierarchy.expanded.includes(mapId));

    anchorPicks.emit("pick", { ownerId: mapId, anchor: kSpawn });

    assert.ok(hierarchy.expanded.includes(mapId));
    assert.deepEqual(revealed, [ActorTreeRows.anchorRowId({ ownerId: mapId, anchor: kSpawn })]);
  });
});
