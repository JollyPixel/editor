// Import Internal Dependencies
import type {
  TilesetDocumentCommand,
  TilesetDocumentCommandAction,
  VoxelBlockCommand,
  VoxelBlockCommandAction,
  VoxelCommandAction,
  VoxelLayerCommand,
  VoxelLayerCommandAction,
  VoxelMaterialGroupCommand,
  VoxelMaterialGroupCommandAction,
  VoxelTilesetCommand,
  VoxelTilesetCommandAction,
  VoxelWorldCommand,
  VoxelWorldCommandAction
} from "./types.ts";

// CONSTANTS
const kActionCategories: {
  readonly [TAction in VoxelCommandAction]: CategoryOf<TAction>;
} = {
  added: "layer",
  removed: "layer",
  updated: "layer",
  cloned: "layer",
  merged: "layer",
  "position-updated": "layer",
  "position-rebased": "layer",
  "voxel-set": "layer",
  "voxel-removed": "layer",
  "voxels-set": "layer",
  "voxels-removed": "layer",
  "voxels-patched": "layer",
  reordered: "layer",
  "layer-moved": "layer",
  "object-layer-added": "layer",
  "object-layer-removed": "layer",
  "object-layer-updated": "layer",
  "object-added": "layer",
  "object-removed": "layer",
  "object-moved": "layer",
  "object-updated": "layer",
  "block-defined": "block",
  "block-removed": "block",
  "block-moved": "block",
  "tileset-added": "tileset",
  "tileset-removed": "tileset",
  "material-group-defined": "material-group",
  "material-group-removed": "material-group"
};
const kCategoryByAction = new Map<string, CommandCategory>(
  Object.entries(kActionCategories)
);
const kTileSizeAction: TilesetDocumentCommandAction = "tile-size-updated";

interface CommandCategories {
  layer: VoxelLayerCommand;
  block: VoxelBlockCommand;
  tileset: VoxelTilesetCommand;
  "material-group": VoxelMaterialGroupCommand;
}

type CommandCategory = keyof CommandCategories;

type CategoryAction<TCategory extends CommandCategory> =
  CommandCategories[TCategory]["action"];

type CategoryOf<TAction extends VoxelCommandAction> = {
  [TCategory in CommandCategory]: TAction extends CategoryAction<TCategory> ?
    TCategory :
    never;
}[CommandCategory];

export const VOXEL_LAYER_COMMAND_ACTIONS:
readonly VoxelLayerCommandAction[] = actionsOf("layer");

export const VOXEL_BLOCK_COMMAND_ACTIONS:
readonly VoxelBlockCommandAction[] = actionsOf("block");

export const VOXEL_TILESET_COMMAND_ACTIONS:
readonly VoxelTilesetCommandAction[] = actionsOf("tileset");

export const VOXEL_MATERIAL_GROUP_COMMAND_ACTIONS:
readonly VoxelMaterialGroupCommandAction[] = actionsOf("material-group");

export const VOXEL_COMMAND_ACTIONS: readonly VoxelCommandAction[] = [
  ...VOXEL_LAYER_COMMAND_ACTIONS,
  ...VOXEL_BLOCK_COMMAND_ACTIONS,
  ...VOXEL_TILESET_COMMAND_ACTIONS,
  ...VOXEL_MATERIAL_GROUP_COMMAND_ACTIONS
];

export const VOXEL_WORLD_COMMAND_ACTIONS:
readonly VoxelWorldCommandAction[] = [
  ...VOXEL_LAYER_COMMAND_ACTIONS,
  ...VOXEL_TILESET_COMMAND_ACTIONS
];

export const TILESET_DOCUMENT_COMMAND_ACTIONS:
readonly TilesetDocumentCommandAction[] = [
  ...VOXEL_BLOCK_COMMAND_ACTIONS,
  ...VOXEL_MATERIAL_GROUP_COMMAND_ACTIONS,
  kTileSizeAction
];

export function isVoxelLayerCommand(
  command: { action: string; }
): command is VoxelLayerCommand {
  return kCategoryByAction.get(command.action) === "layer";
}

export function isVoxelBlockCommand(
  command: { action: string; }
): command is VoxelBlockCommand {
  return kCategoryByAction.get(command.action) === "block";
}

export function isVoxelTilesetCommand(
  command: { action: string; }
): command is VoxelTilesetCommand {
  return kCategoryByAction.get(command.action) === "tileset";
}

export function isVoxelMaterialGroupCommand(
  command: { action: string; }
): command is VoxelMaterialGroupCommand {
  return kCategoryByAction.get(command.action) === "material-group";
}

export function isVoxelWorldCommand(
  command: { action: string; }
): command is VoxelWorldCommand {
  return isVoxelLayerCommand(command) || isVoxelTilesetCommand(command);
}

export function isTilesetDocumentCommand(
  command: { action: string; }
): command is TilesetDocumentCommand {
  return isVoxelBlockCommand(command) ||
    isVoxelMaterialGroupCommand(command) ||
    command.action === kTileSizeAction;
}

function actionsOf<TCategory extends CommandCategory>(
  category: TCategory
): CategoryAction<TCategory>[] {
  return Object.keys(kActionCategories).filter(
    (action): action is CategoryAction<TCategory> => (
      kCategoryByAction.get(action) === category
    )
  );
}
