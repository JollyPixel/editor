// Import Internal Dependencies
import type {
  MaterialSurfacePatchJSON,
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
    case "node-material-changed":
      return [`material:${command.id}`];
    case "material-added":
    case "material-folder-added":
    case "material-removed":
      return [];
    case "material-moved":
      return [`material-parent:${command.id}`];
    case "material-renamed":
      return [`material-name:${command.id}`];
    case "material-changed":
      return materialSurfaceKeys(command.id, command.surface);
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
    case "node-material-changed":
      return [`material:${command.id}`];
    case "material-renamed":
      return [`material-name:${command.id}`];
    case "material-changed":
      return materialSurfaceKeys(command.id, command.surface);
    default:
      return null;
  }
}

function materialSurfaceKeys(
  id: string,
  surface: MaterialSurfacePatchJSON
): string[] {
  return Object.keys(surface).map((field) => `material-surface:${id}:${field}`);
}
