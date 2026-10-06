// Import Third-party Dependencies
import type {
  ModelNodeJSON,
  ModelTreeReader
} from "@jolly-pixel/asset.voxel-model/client";

// CONSTANTS
const kKindLabels: Record<ModelNodeJSON["kind"], string> = {
  folder: "Folder",
  block: "Block"
};

export function kindLabel(
  kind: ModelNodeJSON["kind"]
): string {
  return kKindLabels[kind];
}

export function displayNameOf(
  node: Pick<ModelNodeJSON, "kind" | "name">
): string {
  return node.name || kindLabel(node.kind);
}

export function duplicateNameOf(
  name: string
): string {
  return `${name} Copy`;
}

export function blockNameTakenMessage(
  tree: ModelTreeReader,
  parentId: string | null,
  name: string
): string {
  const parent = blockParentName(tree, tree.enclosingBlockOf(parentId));

  return parent === null ?
    `A root block is already named "${name}"` :
    `"${parent}" already has a block named "${name}"`;
}

export function blockNameClashMessage(
  tree: ModelTreeReader,
  id: string,
  name: string
): string {
  const parent = blockParentName(tree, tree.transformParentOf(id));

  return parent === null ?
    `Another root block is named "${name}"` :
    `Another block in "${parent}" is named "${name}"`;
}

function blockParentName(
  tree: ModelTreeReader,
  blockParentId: string | null
): string | null {
  const parent = blockParentId === null ? undefined : tree.get(blockParentId);

  return parent === undefined ? null : displayNameOf(parent);
}
