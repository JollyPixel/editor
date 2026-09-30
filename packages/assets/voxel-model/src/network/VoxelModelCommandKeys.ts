// Import Internal Dependencies
import type {
  VoxelModelCommand,
  VoxelModelNetworkCommand
} from "./types.ts";

type KeyedCommand = VoxelModelCommand | VoxelModelNetworkCommand;

export function voxelModelConflictKeys(
  command: KeyedCommand
): string[] {
  switch (command.action) {
    case "node-added":
    case "node-removed":
      return [];
    case "node-renamed":
      return [`name:${command.id}`];
    case "node-moved":
      return [
        `parent:${command.id}`,
        ...command.transforms.map(({ id }) => `transform:${id}`)
      ];
    case "node-transformed":
      return [`transform:${command.id}`];
    case "node-uv-changed":
      return [`uv:${command.id}`];
  }
}

export function voxelModelWriteKeys(
  command: KeyedCommand
): string[] | null {
  switch (command.action) {
    case "node-renamed":
      return [`name:${command.id}`];
    case "node-transformed":
      return command.flipAxes === undefined ?
        [`transform:${command.id}`] :
        [`transform:${command.id}`, `flip:${command.id}`];
    case "node-uv-changed":
      return [`uv:${command.id}`];
    default:
      return null;
  }
}
