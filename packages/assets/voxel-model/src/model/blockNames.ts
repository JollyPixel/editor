// Import Third-party Dependencies
import {
  freeName,
  nameKey
} from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type { ModelTreeReader } from "./ModelTree.ts";

export function blockNameTaken(
  tree: ModelTreeReader,
  name: string,
  parentId: string | null,
  exceptId?: string
): boolean {
  return siblingNameKeys(tree, parentId, exceptId).has(nameKey(name));
}

export function freeBlockName(
  tree: ModelTreeReader,
  name: string,
  parentId: string | null
): string {
  const taken = siblingNameKeys(tree, parentId);

  return freeName(name, (candidate) => taken.has(nameKey(candidate)));
}

export function blockNameClashes(
  tree: ModelTreeReader
): Set<string> {
  const byParent = new Map<string | null, Map<string, string[]>>();
  for (const block of tree.blocks()) {
    const parent = tree.transformParentOf(block.id);
    const byName = byParent.get(parent) ?? new Map<string, string[]>();
    const key = nameKey(block.name);
    byName.set(key, [...byName.get(key) ?? [], block.id]);
    byParent.set(parent, byName);
  }

  return new Set(
    [...byParent.values()].flatMap(
      (byName) => [...byName.values()].filter((ids) => ids.length > 1).flat()
    )
  );
}

function siblingNameKeys(
  tree: ModelTreeReader,
  parentId: string | null,
  exceptId?: string
): Set<string> {
  const blockParent = tree.enclosingBlockOf(parentId);
  const keys = new Set<string>();
  for (const block of tree.blocks()) {
    if (block.id !== exceptId && tree.transformParentOf(block.id) === blockParent) {
      keys.add(nameKey(block.name));
    }
  }

  return keys;
}
