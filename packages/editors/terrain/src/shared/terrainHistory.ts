// Import Third-party Dependencies
import {
  terrainHistoryRegistration,
  type TerrainDocument
} from "@jolly-pixel/asset.terrain/client";
import {
  CommandHistory,
  type RefusalWording
} from "@jolly-pixel/history";

// CONSTANTS
const kLimit = 50;

export const TERRAIN_HISTORY_SCOPE = "terrain";
export const TERRAIN_REFUSAL_WORDING: RefusalWording = {
  changed: "the terrain under it changed since"
};

export type TerrainHistoryScope = typeof TERRAIN_HISTORY_SCOPE;
export type TerrainHistory = CommandHistory<TerrainHistoryScope>;

export function createTerrainHistory(
  document: TerrainDocument
): TerrainHistory {
  const history = new CommandHistory<TerrainHistoryScope>({ limit: kLimit });
  history.register(
    terrainHistoryRegistration(document, { scope: TERRAIN_HISTORY_SCOPE })
  );

  return history;
}
