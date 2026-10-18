// Import Third-party Dependencies
import {
  CommandHistory,
  type HistoryRefusal,
  type HistoryStepInfo
} from "@jolly-pixel/history";
import {
  voxelHistoryRegistration,
  type VoxelEdits
} from "@jolly-pixel/asset.voxel-map/client";

// Import Internal Dependencies
import { TemplateDraftId } from "../document/TemplateDraftId.ts";

// CONSTANTS
const kLimit = 10;

export const MAP_HISTORY_SCOPE = "map";
export const TEMPLATE_HISTORY_SCOPE = "template";

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

export function skippedMessage(
  step: HistoryStepInfo
): string {
  const label = step.label === null ? "a step" : `"${step.label}"`;

  return `Skipped ${label}: ${describeHistoryChange(step.refused)}`;
}

function describeHistoryChange(
  refusal: HistoryRefusal
): string {
  switch (refusal.reason) {
    case "peer":
      return refusal.clientId === null ? "it was changed since" : "a peer changed it since";
    case "changed":
      return "its voxels moved or changed since";
    case "server":
      return "the server refused it";
    case "closed":
    case "gone":
      return "it is gone";
  }
}
