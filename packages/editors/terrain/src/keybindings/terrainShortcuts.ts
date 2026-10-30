// Import Third-party Dependencies
import type { KeyBindingHandlers } from "@jolly-pixel/controls";

// Import Internal Dependencies
import {
  TERRAIN_HISTORY_SCOPE,
  type TerrainHistory
} from "../shared/terrainHistory.ts";
import type { TerrainAction } from "./terrainActions.ts";

export function terrainShortcuts(
  history: Pick<TerrainHistory, "undo" | "redo">
): KeyBindingHandlers<TerrainAction> {
  return {
    "edit.undo": () => {
      history.undo(TERRAIN_HISTORY_SCOPE);
    },
    "edit.redo": () => {
      history.redo(TERRAIN_HISTORY_SCOPE);
    }
  };
}
