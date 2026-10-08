// Import Third-party Dependencies
import { CommandHistory } from "@jolly-pixel/history";

// Import Internal Dependencies
import type { VoxelEdits } from "#src/history/VoxelEdits.ts";
import { voxelHistoryRegistration } from "#src/history/voxelHistoryRegistration.ts";

export const MAP_SCOPE = "map";

export function mapHistory(
  edits: VoxelEdits
): CommandHistory<typeof MAP_SCOPE> {
  const history = new CommandHistory({ scopes: [MAP_SCOPE] });
  history.register(voxelHistoryRegistration(edits, { scope: MAP_SCOPE }));

  return history;
}
