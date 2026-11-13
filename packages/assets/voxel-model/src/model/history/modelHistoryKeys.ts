// Import Third-party Dependencies
import {
  KeyedGuard,
  type CommandChange,
  type HistoryKeys,
  type KeyedGuardEntry
} from "@jolly-pixel/history";

// Import Internal Dependencies
import {
  MODEL_ENTRY_TREES,
  entryTree,
  findEntrySlot,
  modelFootprint,
  removedEntry,
  type EntryRef
} from "../command/modelCommands.ts";
import type { ModelCollections } from "../command/ModelCollections.ts";
import type { ModelImage } from "../command/modelImages.ts";
import {
  modelValueKey,
  readModelValue
} from "../command/ModelValueRef.ts";
import type { VoxelModelCommand } from "../types.ts";

// CONSTANTS
const kSubtreeKeyPrefixes = {
  nodes: "subtree",
  materials: "material-subtree"
} as const;

export function modelHistoryKeys(
  tree: ModelCollections
): HistoryKeys<VoxelModelCommand, ModelImage> {
  return {
    written: (change) => [
      ...modelFootprint(change.command).conflicts.map(modelValueKey),
      ...collectContainerKeys(tree, change)
    ],
    guard: (commands) => new KeyedGuard(commands.flatMap((command) => [
      ...modelFootprint(command).conflicts.map((ref): KeyedGuardEntry => {
        return {
          key: modelValueKey(ref),
          read: () => readModelValue(tree, ref)
        };
      }),
      ...removedSubtreeGuards(tree, command)
    ]))
  };
}

function removedSubtreeGuards(
  tree: ModelCollections,
  command: VoxelModelCommand
): KeyedGuardEntry[] {
  const removed = removedEntry(command);
  if (removed === undefined) {
    return [];
  }

  return [{
    key: subtreeKey(removed),
    read: () => {
      const entries = entryTree(tree, removed.which);

      return entries.get(removed.id) === undefined ? undefined : entries.subtreeFrom(removed.id);
    }
  }];
}

function collectContainerKeys(
  tree: ModelCollections,
  change: CommandChange<VoxelModelCommand, ModelImage>
): string[] {
  const { command, image: { before } } = change;
  const slot = findEntrySlot(command);
  const keys = MODEL_ENTRY_TREES.flatMap((which) => {
    const entries = entryTree(tree, which);
    const parents = [
      ...before[which].map(({ parentId }) => parentId),
      ...slot?.which === which ? [slot.parentId] : []
    ];

    return parents
      .flatMap((parentId) => (parentId === null ? [] : [parentId, ...entries.ancestorIds(parentId)]))
      .map((id) => subtreeKey({ which, id }));
  });

  return [...new Set(keys)];
}

function subtreeKey(
  entry: EntryRef
): string {
  return `${kSubtreeKeyPrefixes[entry.which]}:${entry.id}`;
}
