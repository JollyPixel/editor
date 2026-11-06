// Import Third-party Dependencies
import {
  AssetType,
  type AssetReferenceData
} from "@jolly-pixel/asset";
import { SceneDocument } from "@jolly-pixel/asset.scene/client";
import type { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { SceneActions } from "../../../src/editing/SceneActions.ts";
import { createSceneHistory } from "../../../src/features/history/sceneHistory.ts";
import type { PrefabScenes } from "../../../src/scene/PrefabScenes.ts";
import { SelectionStore } from "../../../src/state/SelectionStore.ts";
import { NO_EXPANDED_ACTORS } from "../expandedActors.ts";
import { createProbeBinding } from "../probeComponents.ts";
import { createSceneComponents } from "../sceneComponents.ts";

// CONSTANTS
const kComponents = createSceneComponents([
  "maps",
  {
    components: [
      {
        definition: {
          type: "VoxelMap",
          assets: {
            map: new AssetType<unknown>("voxelmap")
          },
          parse() {
            return {};
          },
          create() {
            return null;
          }
        },
        label: "Voxel map",
        category: "3d",
        icon: "actor-voxel-map",
        form: () => []
      }
    ]
  }
]);

export function createActions(
  picked: AssetReferenceData | null = null,
  anchors: Pick<Systems.SceneAnchorsReader, "findAnchor"> = { findAnchor: () => null },
  prefabs?: PrefabScenes
) {
  const document = new SceneDocument();
  const history = createSceneHistory(document);
  const live = prefabs === undefined ?
    NO_EXPANDED_ACTORS :
    createProbeBinding(document, prefabs).binding;
  const selection = new SelectionStore(document, live);
  const picks: string[] = [];
  const actions = new SceneActions({
    document,
    history,
    selection,
    components: kComponents,
    assetSlots: {
      name: () => "Ground",
      pick: (type) => {
        picks.push(type.kind.value);

        return Promise.resolve(picked);
      },
      pickScene: () => {
        picks.push("scene");

        return Promise.resolve(picked);
      }
    },
    anchors
  });

  return { document, history, selection, actions, picks, live };
}

export function componentTypes(
  document: SceneDocument,
  actorId: string
): string[] {
  return document.tree.actor(actorId)!.components.map(({ type }) => type);
}

export function actorNames(
  document: SceneDocument
): string[] {
  return [...document.tree.actors()].map((actor) => actor.name);
}
