// Import Third-party Dependencies
import { sameTrackPath } from "@jolly-pixel/asset.voxel-animation/client";
import type {
  HistoryGuard,
  HistoryKeys
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  MODEL_ENTRY_TREES,
  entriesOf,
  entrySlotOf,
  removedEntryOf,
  type EntryRef
} from "./modelCommands.ts";
import type { ModelChange } from "./ModelDocument.ts";
import type { ModelImage } from "./modelImages.ts";
import type { ModelTreeReader } from "./ModelTree.ts";
import type { VoxelModelCommand } from "../network/types.ts";
import {
  modelConflictRefs,
  modelValueKey,
  voxelModelConflictKeys,
  type ModelValueRef
} from "../network/VoxelModelCommandKeys.ts";

// CONSTANTS
const kSubtreeKeyPrefixes = {
  nodes: "subtree",
  materials: "material-subtree"
} as const;

export function modelHistoryKeys(
  tree: ModelTreeReader
): HistoryKeys<VoxelModelCommand, ModelImage> {
  return {
    written: (change) => [
      ...voxelModelConflictKeys(change.command),
      ...containerKeysOf(tree, change)
    ],
    guards: (commands) => commands.flatMap((command) => [
      ...modelConflictRefs(command).map((ref) => guardOf(tree, ref)),
      ...removedSubtreeGuards(tree, command)
    ])
  };
}

function guardOf(
  tree: ModelTreeReader,
  ref: ModelValueRef
): HistoryGuard {
  return {
    key: modelValueKey(ref),
    read: () => valueOf(tree, ref)
  };
}

function valueOf(
  tree: ModelTreeReader,
  ref: ModelValueRef
): unknown {
  switch (ref.kind) {
    case "name":
      return tree.get(ref.id)?.name;
    case "parent":
      return tree.get(ref.id)?.parentId;
    case "transform":
      return tree.block(ref.id)?.transform;
    case "flip":
      return tree.block(ref.id)?.flipAxes;
    case "uv":
      return tree.block(ref.id)?.uv;
    case "material":
      return tree.materialIdOf(ref.id);
    case "material-name":
      return tree.materials.get(ref.id)?.name;
    case "material-parent":
      return tree.materials.get(ref.id)?.parentId;
    case "material-surface":
      return Reflect.get(tree.materials.material(ref.id)?.surface ?? {}, ref.field);
    case "animation-own":
      return tree.animationSets.get(ref.id)?.own === true;
    case "animation-binding":
      return tree.animationSets.get(ref.id)?.bindings.find(({ path }) => sameTrackPath(path, ref.path));
  }
}

function removedSubtreeGuards(
  tree: ModelTreeReader,
  command: VoxelModelCommand
): HistoryGuard[] {
  const removed = removedEntryOf(command);
  if (removed === undefined) {
    return [];
  }

  return [{
    key: subtreeKey(removed),
    read: () => {
      const entries = entriesOf(tree, removed.which);

      return entries.get(removed.id) === undefined ? undefined : entries.subtreeOf(removed.id);
    }
  }];
}

function containerKeysOf(
  tree: ModelTreeReader,
  change: ModelChange
): string[] {
  const { command, image: { before } } = change;
  const slot = entrySlotOf(command);
  const keys = MODEL_ENTRY_TREES.flatMap((which) => {
    const entries = entriesOf(tree, which);
    const parents = [
      ...before[which].map(({ parentId }) => parentId),
      ...slot?.which === which ? [slot.parentId] : []
    ];

    return parents
      .flatMap((parentId) => chainOf(parentId, (id) => entries.get(id)?.parentId ?? null))
      .map((id) => subtreeKey({ which, id }));
  });

  return [...new Set(keys)];
}

function subtreeKey(
  entry: EntryRef
): string {
  return `${kSubtreeKeyPrefixes[entry.which]}:${entry.id}`;
}

function chainOf(
  id: string | null,
  parentOf: (id: string) => string | null
): string[] {
  const chain: string[] = [];
  for (let current = id; current !== null && !chain.includes(current); current = parentOf(current)) {
    chain.push(current);
  }

  return chain;
}
