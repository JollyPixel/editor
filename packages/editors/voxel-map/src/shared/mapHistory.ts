// Import Third-party Dependencies
import {
  CommandHistory,
  type RefusalWording
} from "@jolly-pixel/history";
import {
  voxelHistoryRegistration,
  type VoxelEdits
} from "@jolly-pixel/asset.voxel-map/client";

// Import Internal Dependencies
import { TemplateDraftId } from "../map/TemplateDraftId.ts";

// CONSTANTS
const kLimit = 10;

export const MAP_HISTORY_SCOPE = "map";
export const TEMPLATE_HISTORY_SCOPE = "template";
export const MAP_REFUSAL_WORDING: RefusalWording = {
  changed: "its voxels moved or changed since"
};

export type MapHistoryScope =
  | typeof MAP_HISTORY_SCOPE
  | typeof TEMPLATE_HISTORY_SCOPE;

export function editScope(
  draft: TemplateDraftId | null
): MapHistoryScope {
  return draft === null ? MAP_HISTORY_SCOPE : TEMPLATE_HISTORY_SCOPE;
}

export function createMapHistory(
  edits: VoxelEdits
): CommandHistory<MapHistoryScope> {
  const history = new CommandHistory<MapHistoryScope>({ limit: kLimit });
  history.register({
    ...voxelHistoryRegistration(edits, { scope: MAP_HISTORY_SCOPE }),
    resolveScope: ({ command }) => editScope(
      "layerId" in command ? TemplateDraftId.parse(command.layerId) : null
    )
  });

  return history;
}
