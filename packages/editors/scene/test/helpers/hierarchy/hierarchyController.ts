// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import type { AssetReferenceData } from "@jolly-pixel/asset";
import { SceneDocument } from "@jolly-pixel/asset.scene/client";
import type {
  ContextMenuEntry,
  JollySelectDetail
} from "@jolly-pixel/ui";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { InstanceOverrides } from "../../../src/editing/InstanceOverrides.ts";
import { SceneActions } from "../../../src/editing/SceneActions.ts";
import type {
  SceneAssetSlots,
  SceneEditing
} from "../../../src/editing/SceneEditing.ts";
import { HierarchyController } from "../../../src/features/hierarchy/HierarchyController.ts";
import { createSceneHistory } from "../../../src/features/history/sceneHistory.ts";
import type { AnchorPicksEvents } from "../../../src/state/AnchorPicks.ts";
import { PresenceStore } from "../../../src/state/PresenceStore.ts";
import { SelectionStore } from "../../../src/state/SelectionStore.ts";
import { createPrefabScenes } from "../prefabScenes.ts";
import {
  ANCHORED_COMPONENTS,
  createProbeBinding
} from "../probeComponents.ts";
import { createSceneComponents } from "../sceneComponents.ts";

// CONSTANTS
export const MAP_ASSET: AssetReferenceData = { id: "map-1", kind: "voxelmap" };

type HierarchyEditing = Pick<
  SceneEditing,
  | "document"
  | "live"
  | "selection"
  | "anchorPicks"
  | "presence"
  | "components"
  | "overrides"
  | "actions"
  | "assetSlots"
>;

export function createHierarchy(
  open: SceneAssetSlots["open"] = () => undefined,
  components = createSceneComponents(ANCHORED_COMPONENTS)
) {
  const document = new SceneDocument();
  const mapId = document.addActor({
    name: "Map",
    components: [{ id: "map", type: "Anchored", data: {}, assets: { map: MAP_ASSET } }]
  })!;
  const { binding } = createProbeBinding(document);
  const anchorPicks = new Emitter<AnchorPicksEvents>();
  const history = createSceneHistory(document);
  const selection = new SelectionStore(document, binding);
  let assetName = "Overworld";
  const catalog = new Set<() => void>();
  const assetSlots: SceneAssetSlots = {
    name: () => assetName,
    pick: () => Promise.resolve(null),
    pickScene: () => Promise.resolve(null),
    open,
    subscribe: (listener) => {
      catalog.add(listener);

      return () => catalog.delete(listener);
    }
  };
  function renameAsset(
    name: string
  ): void {
    assetName = name;
    for (const listener of catalog) {
      listener();
    }
  }
  const editing: HierarchyEditing = {
    document,
    live: binding,
    selection,
    anchorPicks,
    presence: new PresenceStore(),
    components,
    overrides: new InstanceOverrides({
      document,
      history,
      live: binding,
      prefabs: createPrefabScenes().scenes
    }),
    actions: new SceneActions({
      document,
      history,
      selection,
      components,
      assetSlots,
      anchors: binding
    }),
    assetSlots
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
    selection,
    anchorPicks,
    hierarchy,
    revealed,
    renameAsset
  };
}

export function itemIds(
  items: readonly ContextMenuEntry[]
): string[] {
  return items.map((item) => (item === "separator" ? "-" : item.id));
}

export function selectRows(
  hierarchy: HierarchyController,
  selected: string[],
  id = selected.at(-1) ?? null
): void {
  hierarchy.handleSelect(new CustomEvent<JollySelectDetail>(
    "jolly-select",
    { detail: { selected, id } }
  ));
}
