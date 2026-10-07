// Import Third-party Dependencies
import { CommandHistory } from "@jolly-pixel/history";
import {
  voxelHistoryRegistration,
  type VoxelDocument
} from "@jolly-pixel/voxel.renderer";

export const MAP_SCOPE = "map";

export function mapHistory(
  document: VoxelDocument
): CommandHistory<typeof MAP_SCOPE> {
  const history = new CommandHistory({ scopes: [MAP_SCOPE] });
  history.register(voxelHistoryRegistration(document, { scope: MAP_SCOPE }));

  return history;
}
