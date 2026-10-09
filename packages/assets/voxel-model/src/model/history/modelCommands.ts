// Import Internal Dependencies
import type {
  VoxelModelCommand,
  VoxelModelCommandAction
} from "../../network/types.ts";
import type { ModelImages } from "./modelImages.ts";
import type { ModelTreeReader } from "../ModelTree.ts";
import type {
  OrderedTree,
  OrderedTreeEntry
} from "../OrderedTree.ts";

// CONSTANTS
export const MODEL_ENTRY_TREES = ["nodes", "materials"] as const;

export type ModelEntryTree = typeof MODEL_ENTRY_TREES[number];

export type EntryTreeReader<T extends OrderedTreeEntry> = Pick<
  OrderedTree<T>,
  | "get"
  | "childrenOf"
  | "nextSiblingOf"
  | "subtreeOf"
>;

export interface EntryRef {
  which: ModelEntryTree;
  id: string;
}

export interface EntrySlot extends EntryRef {
  parentId: string | null;
  beforeId: string | undefined;
}

interface ModelCommandSpec<TCommand extends VoxelModelCommand> {
  before(tree: ModelTreeReader, command: TCommand): Partial<ModelImages>;
  slot?(command: TCommand): EntrySlot;
  removes?(command: TCommand): EntryRef;
}

type ModelCommandSpecs = {
  [TAction in VoxelModelCommandAction]: ModelCommandSpec<
    Extract<VoxelModelCommand, { action: TAction; }>
  >;
};

const kModelCommands: ModelCommandSpecs = {
  "node-added": {
    before: nothingBefore,
    slot: ({ node, beforeId }) => {
      return {
        which: "nodes",
        id: node.id,
        parentId: node.parentId,
        beforeId
      };
    }
  },
  "node-removed": {
    before: (tree, { id }) => {
      return { nodes: tree.subtreeOf(id) };
    },
    removes: ({ id }) => {
      return { which: "nodes", id };
    }
  },
  "node-renamed": { before: nodeBefore },
  "node-moved": {
    before: (tree, { id, transforms }) => {
      const ids = new Set([id, ...transforms.map((transform) => transform.id)]);

      return { nodes: [...ids].flatMap((each) => present(tree.get(each))) };
    },
    slot: ({ id, parentId, beforeId }) => {
      return {
        which: "nodes",
        id,
        parentId,
        beforeId
      };
    }
  },
  "node-transformed": { before: nodeBefore },
  "node-uv-changed": { before: nodeBefore },
  "node-material-changed": { before: nodeBefore },
  "material-added": {
    before: nothingBefore,
    slot: ({ material, beforeId }) => {
      return {
        which: "materials",
        id: material.id,
        parentId: material.parentId,
        beforeId
      };
    }
  },
  "material-folder-added": {
    before: nothingBefore,
    slot: ({ folder, beforeId }) => {
      return {
        which: "materials",
        id: folder.id,
        parentId: folder.parentId,
        beforeId
      };
    }
  },
  "material-moved": {
    before: materialBefore,
    slot: ({ id, parentId, beforeId }) => {
      return {
        which: "materials",
        id,
        parentId,
        beforeId
      };
    }
  },
  "material-removed": {
    before: (tree, { id, keepContents }) => {
      if (keepContents === true) {
        const folder = tree.materials.get(id);

        return {
          materials: folder === undefined ? [] : [folder, ...tree.materials.childrenOf(id)]
        };
      }

      const materials = tree.materials.subtreeOf(id);
      const removed = new Set(materials.map((entry) => entry.id));

      return {
        nodes: [...tree.blocks()].filter(
          ({ materialId }) => materialId !== undefined && removed.has(materialId)
        ),
        materials
      };
    },
    removes: ({ id }) => {
      return { which: "materials", id };
    }
  },
  "material-renamed": { before: materialBefore },
  "material-changed": { before: materialBefore },
  "animation-set-linked": {
    before: (tree, { link }) => {
      return { animationSets: present(tree.animationSets.get(link.id)) };
    }
  },
  "animation-set-unlinked": { before: linkBefore },
  "animation-set-owned": { before: linkBefore },
  "animation-binding-changed": { before: linkBefore },
  "animation-binding-cleared": { before: linkBefore }
};

export function entryImagesOf(
  tree: ModelTreeReader,
  command: VoxelModelCommand
): ModelImages {
  return {
    nodes: [],
    materials: [],
    animationSets: [],
    ...specOf(command).before(tree, command)
  };
}

export function entrySlotOf(
  command: VoxelModelCommand
): EntrySlot | undefined {
  return specOf(command).slot?.(command);
}

export function removedEntryOf(
  command: VoxelModelCommand
): EntryRef | undefined {
  return specOf(command).removes?.(command);
}

export function entriesOf(
  tree: ModelTreeReader,
  which: ModelEntryTree
): EntryTreeReader<OrderedTreeEntry> {
  return which === "nodes" ? tree : tree.materials;
}

function specOf(
  command: VoxelModelCommand
): ModelCommandSpec<VoxelModelCommand> {
  return kModelCommands[command.action];
}

function nothingBefore(): Partial<ModelImages> {
  return {};
}

function nodeBefore(
  tree: ModelTreeReader,
  command: { id: string; }
): Partial<ModelImages> {
  return { nodes: present(tree.get(command.id)) };
}

function materialBefore(
  tree: ModelTreeReader,
  command: { id: string; }
): Partial<ModelImages> {
  return { materials: present(tree.materials.get(command.id)) };
}

function linkBefore(
  tree: ModelTreeReader,
  command: { id: string; }
): Partial<ModelImages> {
  return { animationSets: present(tree.animationSets.get(command.id)) };
}

function present<T>(
  value: T | undefined
): T[] {
  return value === undefined ? [] : [value];
}
