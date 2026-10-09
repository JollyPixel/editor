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

// CONSTANTS
const kLimit = 10;

export const MAP_HISTORY_SCOPE = "map";

export type MapHistoryScope = typeof MAP_HISTORY_SCOPE;

export type MapSteps = Pick<CommandHistory<MapHistoryScope>, "open">;

export function createMapHistory(
  edits: VoxelEdits
): CommandHistory<MapHistoryScope> {
  const history = new CommandHistory<MapHistoryScope>({ limit: kLimit });
  history.register(
    voxelHistoryRegistration(edits, { scope: MAP_HISTORY_SCOPE })
  );

  return history;
}

export function skippedMessage(
  step: HistoryStepInfo
): string {
  const label = step.label === null ? "a step" : `"${step.label}"`;

  return `Skipped ${label}: ${reasonOf(step.refused)}`;
}

function reasonOf(
  refusal: HistoryRefusal
): string {
  switch (refusal.reason) {
    case "peer":
      return refusal.clientId === null ? "it was changed since" : "a peer changed it since";
    case "changed":
      return "its voxels moved or changed since";
    case "server":
      return "the server refused it";
    case "dropped":
      return "it was lost while offline";
    case "closed":
    case "gone":
      return "it is gone";
  }
}
