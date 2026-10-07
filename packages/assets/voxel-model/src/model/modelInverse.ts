// Import Third-party Dependencies
import { sameTrackPath } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type {
  MaterialFolderJSON,
  VoxelModelCommand
} from "../network/types.ts";
import {
  InvalidModelTreeError,
  type ModelTreeEntry
} from "./InvalidModelTreeError.ts";
import { materialSurfaceChanges } from "./materialSurface.ts";
import type { EntryTreeReader } from "./modelCommands.ts";
import type { ModelTreeReader } from "./ModelTree.ts";
import type { OrderedTreeEntry } from "./OrderedTree.ts";

// CONSTANTS
const kNoFlip = {
  x: false,
  y: false,
  z: false
};

export function inverseOf(
  tree: ModelTreeReader,
  command: VoxelModelCommand
): VoxelModelCommand[] {
  switch (command.action) {
    case "node-added":
      return [{ action: "node-removed", id: command.node.id }];

    case "node-removed":
      return readdNodes(tree, command.id);

    case "node-renamed": {
      const node = existing(tree.get(command.id), "node", command.id);

      return [{ action: "node-renamed", id: node.id, name: node.name }];
    }

    case "node-moved": {
      const node = existing(tree.get(command.id), "node", command.id);

      return [{
        action: "node-moved",
        id: node.id,
        parentId: node.parentId,
        transforms: command.transforms.map(({ id }) => {
          return {
            id,
            transform: existing(tree.block(id), "node", id).transform
          };
        }),
        ...withBefore(tree.nextSiblingOf(node.id))
      }];
    }

    case "node-transformed": {
      const block = existing(tree.block(command.id), "node", command.id);

      return [{
        action: "node-transformed",
        id: block.id,
        transform: block.transform,
        ...command.flipAxes === undefined ?
          {} :
          { flipAxes: block.flipAxes ?? kNoFlip }
      }];
    }

    case "node-uv-changed": {
      const block = existing(tree.block(command.id), "node", command.id);

      return [{ action: "node-uv-changed", id: block.id, uv: block.uv }];
    }

    case "node-material-changed":
      return [{
        action: "node-material-changed",
        id: command.id,
        materialId: tree.materialIdOf(command.id) ?? null
      }];

    case "material-added":
      return [{ action: "material-removed", id: command.material.id }];

    case "material-folder-added":
      return [{ action: "material-removed", id: command.folder.id }];

    case "material-removed":
      return command.keepContents === true ?
        refoldMaterials(tree, command.id) :
        readdMaterials(tree, command.id);

    case "material-moved": {
      const entry = existing(tree.materials.get(command.id), "material", command.id);

      return [{
        action: "material-moved",
        id: entry.id,
        parentId: entry.parentId,
        ...withBefore(tree.materials.nextSiblingOf(entry.id))
      }];
    }

    case "material-renamed": {
      const entry = existing(tree.materials.get(command.id), "material", command.id);

      return [{ action: "material-renamed", id: entry.id, name: entry.name }];
    }

    case "material-changed": {
      const material = existing(
        tree.materials.material(command.id),
        "material",
        command.id
      );
      const surface = materialSurfaceChanges(
        {
          ...material.surface,
          ...command.surface
        },
        material.surface
      );

      return Object.keys(surface).length === 0 ?
        [] :
        [{ action: "material-changed", id: material.id, surface }];
    }

    case "animation-set-linked":
      return [{ action: "animation-set-unlinked", id: command.link.id }];

    case "animation-set-unlinked":
      return [{
        action: "animation-set-linked",
        link: existing(tree.animationSets.get(command.id), "animation-set", command.id)
      }];

    case "animation-set-owned": {
      const link = existing(tree.animationSets.get(command.id), "animation-set", command.id);

      return [{ action: "animation-set-owned", id: command.id, own: link.own === true }];
    }

    case "animation-binding-changed":
    case "animation-binding-cleared": {
      const link = existing(tree.animationSets.get(command.id), "animation-set", command.id);
      const binding = link.bindings.find(({ path }) => sameTrackPath(path, command.path));

      return [binding === undefined ?
        { action: "animation-binding-cleared", id: command.id, path: command.path } :
        { action: "animation-binding-changed", id: command.id, ...binding }];
    }
  }
}

function existing<T>(
  value: T | undefined,
  entry: ModelTreeEntry,
  id: string
): T {
  if (value === undefined) {
    throw new InvalidModelTreeError(entry, id, "is missing for a command the tree accepted");
  }

  return value;
}

function withBefore(
  beforeId: string | undefined
): { beforeId?: string; } {
  return beforeId === undefined ? {} : { beforeId };
}

function readdNodes(
  tree: ModelTreeReader,
  id: string
): VoxelModelCommand[] {
  return readded(tree, id, "node").map(({ entry, before }) => {
    return {
      action: "node-added",
      node: entry,
      ...before
    };
  });
}

function readdMaterials(
  tree: ModelTreeReader,
  id: string
): VoxelModelCommand[] {
  const placed = readded(tree.materials, id, "material");
  const removed = new Set(placed.map(({ entry }) => entry.id));
  const readdedEntries = placed.map(({ entry, before }): VoxelModelCommand => (
    entry.kind === "folder" ?
      { action: "material-folder-added", folder: entry, ...before } :
      { action: "material-added", material: entry, ...before }
  ));
  const reassigned = [...tree.blocks()].flatMap(
    ({ id: blockId, materialId }): VoxelModelCommand[] => (
      materialId !== undefined && removed.has(materialId) ?
        [{ action: "node-material-changed", id: blockId, materialId }] :
        []
    )
  );

  return [...readdedEntries, ...reassigned];
}

interface ReaddedEntry<T> {
  entry: T;
  before: { beforeId?: string; };
}

function readded<T extends OrderedTreeEntry>(
  entries: EntryTreeReader<T>,
  id: string,
  kind: ModelTreeEntry
): ReaddedEntry<T>[] {
  const root = existing(entries.get(id), kind, id);
  const before = withBefore(entries.nextSiblingOf(id));

  return preorder(root, (parentId) => entries.childrenOf(parentId)).map(
    (entry, index) => {
      return {
        entry,
        before: index === 0 ? before : {}
      };
    }
  );
}

function refoldMaterials(
  tree: ModelTreeReader,
  id: string
): VoxelModelCommand[] {
  const folder = existingFolder(tree, id);

  return [
    {
      action: "material-folder-added",
      folder,
      ...withBefore(tree.materials.nextSiblingOf(id))
    },
    ...tree.materials.childrenOf(id).map((child): VoxelModelCommand => {
      return {
        action: "material-moved",
        id: child.id,
        parentId: id
      };
    })
  ];
}

function existingFolder(
  tree: ModelTreeReader,
  id: string
): MaterialFolderJSON {
  const entry = existing(tree.materials.get(id), "material", id);
  if (entry.kind !== "folder") {
    throw new InvalidModelTreeError("material", id, "is not a folder");
  }

  return entry;
}

function preorder<T extends OrderedTreeEntry>(
  root: T,
  childrenOf: (parentId: string) => T[]
): T[] {
  return [
    root,
    ...childrenOf(root.id).flatMap((child) => preorder(child, childrenOf))
  ];
}
