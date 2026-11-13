// Import Third-party Dependencies
import {
  InvalidEntryError,
  withBefore,
  type OrderedTree,
  type OrderedTreeEntry
} from "@jolly-pixel/asset.common";
import type { CommandChange } from "@jolly-pixel/history";

// Import Internal Dependencies
import type {
  MaterialFolderJSON,
  ModelNodeJSON,
  VoxelModelCommand,
  VoxelModelCommandAction
} from "../types.ts";
import { AnimationSetLink } from "../animation/AnimationSetLink.ts";
import { MaterialSurface } from "../materials/MaterialSurface.ts";
import type {
  ModelCollections,
  ModelStores
} from "./ModelCollections.ts";
import {
  entryOrder,
  type ModelImage,
  type ModelImages
} from "./modelImages.ts";
import {
  materialValueRefs,
  nodeValueRefs,
  type ModelValueRef
} from "./ModelValueRef.ts";

// CONSTANTS
export const MODEL_ENTRY_TREES = ["nodes", "materials"] as const;

export type ModelEntryTree = typeof MODEL_ENTRY_TREES[number];

export type EntryTreeReader<T extends OrderedTreeEntry> = Pick<
  OrderedTree<T>,
  | "get"
  | "listChildren"
  | "findNextSibling"
  | "subtreeFrom"
  | "ancestorIds"
  | "isSiblingSlot"
>;

export interface EntryRef {
  which: ModelEntryTree;
  id: string;
}

export interface EntrySlot extends EntryRef {
  parentId: string | null;
  beforeId: string | undefined;
}

export interface ModelFootprint {
  readonly node: string | null;
  readonly writes: readonly ModelValueRef[] | null;
  readonly conflicts: readonly ModelValueRef[];
}

type ModelCommandChange = Pick<
  CommandChange<VoxelModelCommand, ModelImage>,
  "command" | "image"
>;

interface ModelCommandSpec<TCommand extends VoxelModelCommand> {
  accepts(tree: ModelCollections, command: TCommand): boolean;
  apply(stores: ModelStores, command: TCommand): void;
  before(tree: ModelCollections, command: TCommand): Partial<ModelImages>;
  slot?(command: TCommand): EntrySlot;
  removes?(command: TCommand): EntryRef;
  node?(command: TCommand): string;
  writes(command: TCommand): ModelValueRef[] | null;
  conflicts?(command: TCommand): ModelValueRef[];
  invert(tree: ModelCollections, command: TCommand): VoxelModelCommand[];
  label(command: TCommand, before: ModelImages): string;
}

type ModelCommandSpecs = {
  [TAction in VoxelModelCommandAction]: ModelCommandSpec<
    Extract<VoxelModelCommand, { action: TAction; }>
  >;
};

const kModelCommands: ModelCommandSpecs = {
  "node-added": {
    accepts: (tree, { node, beforeId }) => tree.nodes.canAdd(node, beforeId) &&
      tree.materials.isAssignable(node.kind === "block" ? node.materialId : undefined),
    apply: (stores, { node, beforeId }) => stores.nodes.add(node, beforeId),
    before: nothingBefore,
    slot: ({ node, beforeId }) => entrySlot("nodes", node, beforeId),
    node: ({ node }) => node.id,
    writes: noWrites,
    invert: (_tree, { node }) => [{ action: "node-removed", id: node.id }],
    label: ({ node }) => `Add ${node.name}`
  },
  "node-removed": {
    accepts: (tree, { id }) => tree.nodes.has(id),
    apply: (stores, { id }) => stores.nodes.remove(id),
    before: (tree, { id }) => {
      return { nodes: tree.nodes.subtreeFrom(id) };
    },
    removes: ({ id }) => {
      return { which: "nodes", id };
    },
    node: ({ id }) => id,
    writes: noWrites,
    conflicts: ({ id }) => nodeValueRefs(id),
    invert: (tree, { id }) => readded(tree.nodes, id, "node").map(({ entry, before }) => {
      return {
        action: "node-added",
        node: entry,
        ...before
      };
    }),
    label: (_command, before) => `Delete ${firstName(before.nodes)}`
  },
  "node-renamed": {
    accepts: (tree, { id }) => tree.nodes.has(id),
    apply: (stores, { id, name }) => stores.nodes.rename(id, name),
    before: nodeBefore,
    node: ({ id }) => id,
    writes: ({ id }) => [{ kind: "name", id }],
    invert: (tree, { id }) => {
      const node = existing(tree.nodes.get(id), "node", id);

      return [{ action: "node-renamed", id, name: node.name }];
    },
    label: (_command, before) => `Rename ${firstName(before.nodes)}`
  },
  "node-moved": {
    accepts: (tree, { id, parentId, beforeId, transforms }) => (
      tree.nodes.canMove(id, parentId, beforeId) &&
      transforms.every((transform) => tree.nodes.isBlock(transform.id))
    ),
    apply: (stores, { id, parentId, beforeId, transforms }) => {
      stores.nodes.move(id, parentId, beforeId);
      for (const { id: blockId, transform } of transforms) {
        stores.nodes.patchBlock(blockId, { transform });
      }
    },
    before: (tree, { id, transforms }) => {
      const ids = new Set([id, ...transforms.map((transform) => transform.id)]);

      return { nodes: [...ids].flatMap((each) => present(tree.nodes.get(each))) };
    },
    slot: ({ id, parentId, beforeId }) => {
      return {
        which: "nodes",
        id,
        parentId,
        beforeId
      };
    },
    node: ({ id }) => id,
    writes: noWrites,
    conflicts: ({ id, transforms }) => [
      { kind: "parent", id },
      ...transforms.map(({ id: blockId }): ModelValueRef => {
        return { kind: "transform", id: blockId };
      })
    ],
    invert: (tree, { id, transforms }) => {
      const node = existing(tree.nodes.get(id), "node", id);

      return [{
        action: "node-moved",
        id,
        parentId: node.parentId,
        transforms: transforms.map(({ id: blockId }) => {
          return {
            id: blockId,
            transform: existing(tree.nodes.block(blockId), "node", blockId).transform
          };
        }),
        ...withBefore(tree.nodes.findNextSibling(id))
      }];
    },
    label: (_command, before) => `Move ${firstName(before.nodes)}`
  },
  "node-transformed": {
    accepts: (tree, { id }) => tree.nodes.isBlock(id),
    apply: (stores, { id, transform, flipAxes }) => stores.nodes.patchBlock(
      id,
      flipAxes === undefined ? { transform } : { transform, flipAxes }
    ),
    before: nodeBefore,
    node: ({ id }) => id,
    writes: ({ id, flipAxes }) => (flipAxes === undefined ?
      [{ kind: "transform", id }] :
      [{ kind: "transform", id }, { kind: "flip", id }]),
    invert: (tree, { id, flipAxes }) => {
      const block = existing(tree.nodes.block(id), "node", id);

      return [{
        action: "node-transformed",
        id,
        transform: block.transform,
        ...flipAxes === undefined ? {} : { flipAxes: block.flipAxes }
      }];
    },
    label: (_command, before) => `Transform ${firstName(before.nodes)}`
  },
  "node-uv-changed": {
    accepts: (tree, { id }) => tree.nodes.isBlock(id),
    apply: (stores, { id, uv }) => stores.nodes.patchBlock(id, { uv }),
    before: nodeBefore,
    node: ({ id }) => id,
    writes: ({ id }) => [{ kind: "uv", id }],
    invert: (tree, { id }) => {
      const block = existing(tree.nodes.block(id), "node", id);

      return [{ action: "node-uv-changed", id, uv: block.uv }];
    },
    label: (_command, before) => `Edit UVs of ${firstName(before.nodes)}`
  },
  "node-shape-changed": {
    accepts: (tree, { id }) => tree.nodes.isBlock(id),
    apply: (stores, { id, shape, uv }) => stores.nodes.patchBlock(id, { shape, uv }),
    before: nodeBefore,
    node: ({ id }) => id,
    writes: ({ id }) => [{ kind: "shape", id }, { kind: "uv", id }],
    invert: (tree, { id }) => {
      const block = existing(tree.nodes.block(id), "node", id);

      return [{ action: "node-shape-changed", id, shape: block.shape, uv: block.uv }];
    },
    label: (_command, before) => `Set shape of ${firstName(before.nodes)}`
  },
  "node-material-changed": {
    accepts: (tree, { id, materialId }) => tree.nodes.isBlock(id) &&
      tree.materials.isAssignable(materialId),
    apply: (stores, { id, materialId }) => stores.nodes.assignMaterial(id, materialId),
    before: nodeBefore,
    node: ({ id }) => id,
    writes: ({ id }) => [{ kind: "material", id }],
    invert: (tree, { id }) => [{
      action: "node-material-changed",
      id,
      materialId: tree.nodes.blockMaterialId(id) ?? null
    }],
    label: (_command, before) => `Set material of ${firstName(before.nodes)}`
  },
  "material-added": {
    accepts: (tree, { material, beforeId }) => tree.materials.canAdd(material, beforeId) &&
      MaterialSurface.parse(material.surface) !== undefined,
    apply: (stores, { material, beforeId }) => stores.materials.add(material, beforeId),
    before: nothingBefore,
    slot: ({ material, beforeId }) => entrySlot("materials", material, beforeId),
    writes: noWrites,
    invert: (_tree, { material }) => [{ action: "material-removed", id: material.id }],
    label: ({ material }) => `Add material ${material.name}`
  },
  "material-folder-added": {
    accepts: (tree, { folder, beforeId }) => tree.materials.canAdd(folder, beforeId),
    apply: (stores, { folder, beforeId }) => stores.materials.add(folder, beforeId),
    before: nothingBefore,
    slot: ({ folder, beforeId }) => entrySlot("materials", folder, beforeId),
    writes: noWrites,
    invert: (_tree, { folder }) => [{ action: "material-removed", id: folder.id }],
    label: ({ folder }) => `Add folder ${folder.name}`
  },
  "material-moved": {
    accepts: (tree, { id, parentId, beforeId }) => tree.materials.canMove(id, parentId, beforeId),
    apply: (stores, { id, parentId, beforeId }) => stores.materials.move(id, parentId, beforeId),
    before: materialBefore,
    slot: ({ id, parentId, beforeId }) => {
      return {
        which: "materials",
        id,
        parentId,
        beforeId
      };
    },
    writes: noWrites,
    conflicts: ({ id }) => [{ kind: "material-parent", id }],
    invert: (tree, { id }) => {
      const entry = existing(tree.materials.get(id), "material", id);

      return [{
        action: "material-moved",
        id,
        parentId: entry.parentId,
        ...withBefore(tree.materials.findNextSibling(id))
      }];
    },
    label: (_command, before) => `Move ${firstName(before.materials)}`
  },
  "material-removed": {
    accepts: (tree, { id, keepContents }) => (keepContents === true ?
      tree.materials.get(id)?.kind === "folder" :
      tree.materials.has(id)),
    apply: (stores, { id, keepContents }) => {
      if (keepContents === true) {
        stores.materials.liftChildren(id);
      }
      const removed = new Set(stores.materials.peekSubtree(id).map((entry) => entry.id));
      stores.materials.remove(id);
      stores.nodes.dropMaterials(removed);
    },
    before: (tree, { id, keepContents }) => {
      if (keepContents === true) {
        const folder = tree.materials.get(id);

        return {
          materials: folder === undefined ? [] : [folder, ...tree.materials.listChildren(id)]
        };
      }

      const materials = tree.materials.subtreeFrom(id);
      const removed = new Set(materials.map((entry) => entry.id));

      return {
        nodes: tree.nodes.blocksUsingAny(removed),
        materials
      };
    },
    removes: ({ id }) => {
      return { which: "materials", id };
    },
    writes: noWrites,
    conflicts: ({ id }) => materialValueRefs(id),
    invert: (tree, { id, keepContents }) => (keepContents === true ?
      refoldMaterials(tree, id) :
      readdMaterials(tree, id)),
    label: (_command, before) => `Delete ${firstName(before.materials)}`
  },
  "material-renamed": {
    accepts: (tree, { id }) => tree.materials.has(id),
    apply: (stores, { id, name }) => stores.materials.rename(id, name),
    before: materialBefore,
    writes: ({ id }) => [{ kind: "material-name", id }],
    invert: (tree, { id }) => {
      const entry = existing(tree.materials.get(id), "material", id);

      return [{ action: "material-renamed", id, name: entry.name }];
    },
    label: (_command, before) => `Rename ${firstName(before.materials)}`
  },
  "material-changed": {
    accepts: (tree, { id, surface }) => tree.materials.material(id) !== undefined &&
      MaterialSurface.parsePatch(surface) !== undefined,
    apply: (stores, { id, surface }) => stores.materials.changeSurface(id, surface),
    before: materialBefore,
    writes: ({ id, surface }) => Object.keys(surface).map((field) => {
      return { kind: "material-surface", id, field };
    }),
    invert: (tree, { id, surface }) => {
      const material = existing(tree.materials.material(id), "material", id);
      const restored = new MaterialSurface({
        ...material.surface,
        ...surface
      }).changesTo(material.surface);

      return Object.keys(restored).length === 0 ?
        [] :
        [{ action: "material-changed", id, surface: restored }];
    },
    label: (_command, before) => `Edit ${firstName(before.materials)}`
  },
  "animation-set-linked": {
    accepts: (tree, { link }) => !tree.animationSets.has(link.id) &&
      (link.own !== true || tree.animationSets.owned === undefined) &&
      AnimationSetLink.findProblem(link) === null,
    apply: (stores, { link }) => stores.animationSets.link(link),
    before: (tree, { link }) => {
      return { animationSets: present(tree.animationSets.get(link.id)) };
    },
    writes: noWrites,
    invert: (_tree, { link }) => [{ action: "animation-set-unlinked", id: link.id }],
    label: () => "Link animation set"
  },
  "animation-set-unlinked": {
    accepts: (tree, { id }) => tree.animationSets.has(id),
    apply: (stores, { id }) => stores.animationSets.unlink(id),
    before: linkBefore,
    writes: noWrites,
    invert: (tree, { id }) => [{
      action: "animation-set-linked",
      link: existing(tree.animationSets.get(id), "animation-set", id)
    }],
    label: () => "Unlink animation set"
  },
  "animation-set-owned": {
    accepts: (tree, { id, own }) => {
      const owner = tree.animationSets.owned?.id;

      return tree.animationSets.has(id) &&
        (!own || owner === undefined || owner === id);
    },
    apply: (stores, { id, own }) => stores.animationSets.update(id, (link) => link.withOwn(own)),
    before: linkBefore,
    writes: ({ id }) => [{ kind: "animation-own", id }],
    invert: (tree, { id }) => {
      const link = existing(tree.animationSets.get(id), "animation-set", id);

      return [{ action: "animation-set-owned", id, own: link.own === true }];
    },
    label: ({ own }) => (own ? "Keep animations on this model" : "Share animations as a set")
  },
  "animation-binding-changed": {
    accepts: (tree, { id }) => tree.animationSets.has(id),
    apply: (stores, { id, path, target }) => stores.animationSets.update(
      id,
      (link) => link.withBinding({ path, target })
    ),
    before: linkBefore,
    writes: bindingWrites,
    invert: invertBinding,
    label: ({ path, target }) => `${target === null ? "Ignore" : "Rebind"} ${path}`
  },
  "animation-binding-cleared": {
    accepts: (tree, { id }) => tree.animationSets.has(id),
    apply: (stores, { id, path }) => stores.animationSets.update(
      id,
      (link) => link.withoutBinding(path)
    ),
    before: linkBefore,
    writes: bindingWrites,
    invert: invertBinding,
    label: ({ path }) => `Reset ${path}`
  }
};

export function acceptsModelCommand(
  tree: ModelCollections,
  command: VoxelModelCommand
): boolean {
  return commandSpec(command).accepts(tree, command);
}

export function applyModelCommand(
  stores: ModelStores,
  command: VoxelModelCommand
): void {
  commandSpec(command).apply(stores, command);
}

export function placeModelCommand(
  tree: ModelCollections,
  command: VoxelModelCommand
): VoxelModelCommand {
  const slot = findEntrySlot(command);
  if (
    slot?.beforeId === undefined ||
    entryTree(tree, slot.which).isSiblingSlot(slot.beforeId, slot.parentId, slot.id)
  ) {
    return command;
  }

  return withoutBefore(command);
}

export function captureModelImage(
  tree: ModelCollections,
  command: VoxelModelCommand
): ModelImage {
  return {
    before: {
      nodes: [],
      materials: [],
      animationSets: [],
      ...commandSpec(command).before(tree, command)
    },
    order: entryOrder(tree)
  };
}

export function findEntrySlot(
  command: VoxelModelCommand
): EntrySlot | undefined {
  return commandSpec(command).slot?.(command);
}

export function removedEntry(
  command: VoxelModelCommand
): EntryRef | undefined {
  return commandSpec(command).removes?.(command);
}

export function invertModelCommand(
  tree: ModelCollections,
  command: VoxelModelCommand
): VoxelModelCommand[] {
  return commandSpec(command).invert(tree, command);
}

export function modelFootprint(
  command: VoxelModelCommand
): ModelFootprint {
  const spec = commandSpec(command);
  const writes = spec.writes(command);

  return {
    node: spec.node?.(command) ?? null,
    writes,
    conflicts: spec.conflicts?.(command) ?? writes ?? []
  };
}

export function modelChangeLabel(
  change: ModelCommandChange
): string {
  const { command, image } = change;

  return commandSpec(command).label(command, image.before);
}

export function removedModelNodes(
  change: ModelCommandChange
): readonly ModelNodeJSON[] {
  return change.command.action === "node-removed" ? change.image.before.nodes : [];
}

export function entryTree(
  tree: ModelCollections,
  which: ModelEntryTree
): EntryTreeReader<OrderedTreeEntry> {
  return which === "nodes" ? tree.nodes : tree.materials;
}

function commandSpec(
  command: VoxelModelCommand
): ModelCommandSpec<VoxelModelCommand> {
  return kModelCommands[command.action];
}

function withoutBefore(
  command: VoxelModelCommand
): VoxelModelCommand {
  if (!("beforeId" in command)) {
    return command;
  }

  const { beforeId: _beforeId, ...placed } = command;

  return placed;
}

function entrySlot(
  which: ModelEntryTree,
  entry: OrderedTreeEntry,
  beforeId: string | undefined
): EntrySlot {
  return {
    which,
    id: entry.id,
    parentId: entry.parentId,
    beforeId
  };
}

function noWrites(): null {
  return null;
}

function nothingBefore(): Partial<ModelImages> {
  return {};
}

function nodeBefore(
  tree: ModelCollections,
  command: { id: string; }
): Partial<ModelImages> {
  return { nodes: present(tree.nodes.get(command.id)) };
}

function materialBefore(
  tree: ModelCollections,
  command: { id: string; }
): Partial<ModelImages> {
  return { materials: present(tree.materials.get(command.id)) };
}

function linkBefore(
  tree: ModelCollections,
  command: { id: string; }
): Partial<ModelImages> {
  return { animationSets: present(tree.animationSets.get(command.id)) };
}

function firstName(
  entries: readonly { name: string; }[]
): string {
  return entries[0]?.name ?? "";
}

function bindingWrites(
  command: { id: string; path: string; }
): ModelValueRef[] {
  return [{ kind: "animation-binding", id: command.id, path: command.path }];
}

function invertBinding(
  tree: ModelCollections,
  command: { id: string; path: string; }
): VoxelModelCommand[] {
  const { id, path } = command;
  existing(tree.animationSets.get(id), "animation-set", id);
  const binding = tree.animationSets.binding(id, path);

  return [binding === undefined ?
    { action: "animation-binding-cleared", id, path } :
    { action: "animation-binding-changed", id, ...binding }];
}

function present<T>(
  value: T | undefined
): T[] {
  return value === undefined ? [] : [value];
}

function existing<T>(
  value: T | undefined,
  entry: string,
  id: string
): T {
  if (value === undefined) {
    throw new InvalidEntryError(entry, id, "is missing for a command the tree accepted");
  }

  return value;
}

interface ReaddedEntry<T> {
  entry: T;
  before: { beforeId?: string; };
}

function readded<T extends OrderedTreeEntry>(
  entries: EntryTreeReader<T>,
  id: string,
  kind: string
): ReaddedEntry<T>[] {
  const root = existing(entries.get(id), kind, id);
  const before = withBefore(entries.findNextSibling(id));

  return preorder(root, (parentId) => entries.listChildren(parentId)).map(
    (entry, index) => {
      return {
        entry,
        before: index === 0 ? before : {}
      };
    }
  );
}

function readdMaterials(
  tree: ModelCollections,
  id: string
): VoxelModelCommand[] {
  const placed = readded(tree.materials, id, "material");
  const removed = new Set(placed.map(({ entry }) => entry.id));
  const readdedEntries = placed.map(({ entry, before }): VoxelModelCommand => (
    entry.kind === "folder" ?
      { action: "material-folder-added", folder: entry, ...before } :
      { action: "material-added", material: entry, ...before }
  ));
  const reassigned = tree.nodes.blocksUsingAny(removed).map(
    ({ id: blockId, materialId }): VoxelModelCommand => {
      return { action: "node-material-changed", id: blockId, materialId };
    }
  );

  return [...readdedEntries, ...reassigned];
}

function refoldMaterials(
  tree: ModelCollections,
  id: string
): VoxelModelCommand[] {
  const folder = existingFolder(tree, id);

  return [
    {
      action: "material-folder-added",
      folder,
      ...withBefore(tree.materials.findNextSibling(id))
    },
    ...tree.materials.listChildren(id).map((child): VoxelModelCommand => {
      return {
        action: "material-moved",
        id: child.id,
        parentId: id
      };
    })
  ];
}

function existingFolder(
  tree: ModelCollections,
  id: string
): MaterialFolderJSON {
  const entry = existing(tree.materials.get(id), "material", id);
  if (entry.kind !== "folder") {
    throw new InvalidEntryError("material", id, "is not a folder");
  }

  return entry;
}

function preorder<T extends OrderedTreeEntry>(
  root: T,
  listChildren: (parentId: string) => T[]
): T[] {
  return [
    root,
    ...listChildren(root.id).flatMap((child) => preorder(child, listChildren))
  ];
}
