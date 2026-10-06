// Import Internal Dependencies
import type {
  BlocksetDocumentCommand,
  BlocksetDocumentCommandAction,
  VoxelBlendGroupCommand,
  VoxelBlendGroupCommandAction,
  VoxelBlockCommand,
  VoxelBlockCommandAction,
  VoxelCommandAction,
  VoxelEditCommand,
  VoxelLayerCommand,
  VoxelLayerCommandAction,
  VoxelMaterialGroupCommand,
  VoxelMaterialGroupCommandAction,
  VoxelObjectLayerCommand,
  VoxelTemplateCommand,
  VoxelTemplateCommandAction,
  VoxelBlocksetCommand,
  VoxelBlocksetCommandAction,
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
  "layer-transformed": "layer",
  "layer-moved": "layer",
  "object-layer-added": "layer",
  "object-layer-removed": "layer",
  "object-layer-updated": "layer",
  "object-added": "layer",
  "object-removed": "layer",
  "object-moved": "layer",
  "object-updated": "layer",
  "template-defined": "template",
  "template-updated": "template",
  "template-removed": "template",
  "block-defined": "block",
  "block-removed": "block",
  "block-moved": "block",
  "blockset-added": "blockset",
  "blockset-removed": "blockset",
  "material-group-defined": "material-group",
  "material-group-removed": "material-group",
  "blend-group-defined": "blend-group",
  "blend-group-removed": "blend-group"
};
const kCategoryByAction = new Map<string, CommandCategory>(
  Object.entries(kActionCategories)
);
const kBlocksetOnlyActions = [
  "tile-size-updated",
  "material-group-renamed"
] as const satisfies readonly BlocksetDocumentCommandAction[];
const kBlocksetOnlyActionSet = new Set<string>(kBlocksetOnlyActions);
const kEditActions = new Set<string>([
  "voxel-set",
  "voxel-removed",
  "voxels-set",
  "voxels-removed",
  "voxels-patched",
  "layer-transformed"
] satisfies VoxelEditCommand["action"][]);
const kPositionActions = new Set<string>([
  "position-updated",
  "position-rebased"
] satisfies VoxelLayerCommandAction[]);

interface CommandCategories {
  layer: VoxelLayerCommand;
  template: VoxelTemplateCommand;
  block: VoxelBlockCommand;
  blockset: VoxelBlocksetCommand;
  "material-group": VoxelMaterialGroupCommand;
  "blend-group": VoxelBlendGroupCommand;
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

export const VOXEL_TEMPLATE_COMMAND_ACTIONS:
readonly VoxelTemplateCommandAction[] = actionsOf("template");

export const VOXEL_BLOCK_COMMAND_ACTIONS:
readonly VoxelBlockCommandAction[] = actionsOf("block");

export const VOXEL_BLOCKSET_COMMAND_ACTIONS:
readonly VoxelBlocksetCommandAction[] = actionsOf("blockset");

export const VOXEL_MATERIAL_GROUP_COMMAND_ACTIONS:
readonly VoxelMaterialGroupCommandAction[] = actionsOf("material-group");

export const VOXEL_BLEND_GROUP_COMMAND_ACTIONS:
readonly VoxelBlendGroupCommandAction[] = actionsOf("blend-group");

export const VOXEL_COMMAND_ACTIONS: readonly VoxelCommandAction[] = [
  ...VOXEL_LAYER_COMMAND_ACTIONS,
  ...VOXEL_TEMPLATE_COMMAND_ACTIONS,
  ...VOXEL_BLOCK_COMMAND_ACTIONS,
  ...VOXEL_BLOCKSET_COMMAND_ACTIONS,
  ...VOXEL_MATERIAL_GROUP_COMMAND_ACTIONS,
  ...VOXEL_BLEND_GROUP_COMMAND_ACTIONS
];

export const VOXEL_WORLD_COMMAND_ACTIONS:
readonly VoxelWorldCommandAction[] = [
  ...VOXEL_LAYER_COMMAND_ACTIONS,
  ...VOXEL_TEMPLATE_COMMAND_ACTIONS,
  ...VOXEL_BLOCKSET_COMMAND_ACTIONS
];

export const BLOCKSET_DOCUMENT_COMMAND_ACTIONS:
readonly BlocksetDocumentCommandAction[] = [
  ...VOXEL_BLOCK_COMMAND_ACTIONS,
  ...VOXEL_MATERIAL_GROUP_COMMAND_ACTIONS,
  ...VOXEL_BLEND_GROUP_COMMAND_ACTIONS,
  ...kBlocksetOnlyActions
];

export function isVoxelLayerCommand(
  command: { action: string; }
): command is VoxelLayerCommand {
  return kCategoryByAction.get(command.action) === "layer";
}

export function isVoxelEditCommand(
  command: { action: string; }
): command is VoxelEditCommand {
  return kEditActions.has(command.action);
}

export function isVoxelLayerGeometryCommand(
  command: { action: string; }
): command is VoxelLayerCommand {
  return kEditActions.has(command.action) ||
    kPositionActions.has(command.action);
}

export function isVoxelObjectLayerCommand(
  command: { action: string; }
): command is VoxelObjectLayerCommand {
  return isVoxelLayerCommand(command) && command.action.startsWith("object-");
}

export function isVoxelTemplateCommand(
  command: { action: string; }
): command is VoxelTemplateCommand {
  return kCategoryByAction.get(command.action) === "template";
}

export function isVoxelBlockCommand(
  command: { action: string; }
): command is VoxelBlockCommand {
  return kCategoryByAction.get(command.action) === "block";
}

export function isVoxelBlocksetCommand(
  command: { action: string; }
): command is VoxelBlocksetCommand {
  return kCategoryByAction.get(command.action) === "blockset";
}

export function isVoxelMaterialGroupCommand(
  command: { action: string; }
): command is VoxelMaterialGroupCommand {
  return kCategoryByAction.get(command.action) === "material-group";
}

export function isVoxelBlendGroupCommand(
  command: { action: string; }
): command is VoxelBlendGroupCommand {
  return kCategoryByAction.get(command.action) === "blend-group";
}

export function isVoxelWorldCommand(
  command: { action: string; }
): command is VoxelWorldCommand {
  return isVoxelLayerCommand(command) ||
    isVoxelTemplateCommand(command) ||
    isVoxelBlocksetCommand(command);
}

export function isBlocksetDocumentCommand(
  command: { action: string; }
): command is BlocksetDocumentCommand {
  return isVoxelBlockCommand(command) ||
    isVoxelMaterialGroupCommand(command) ||
    isVoxelBlendGroupCommand(command) ||
    kBlocksetOnlyActionSet.has(command.action);
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
