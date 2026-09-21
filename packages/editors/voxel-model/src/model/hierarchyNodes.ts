// Import Third-party Dependencies
import type {
  ModelNodeJSON,
  ModelNodeKind,
  ModelTreeReader
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// CONSTANTS
const kFallbackNames: Record<ModelNodeKind, string> = {
  folder: "Folder",
  block: "Block"
};

export type HierarchyNodeKind = ModelNodeKind;

export interface HierarchyNode {
  id: string;
  name: string;
  kind: HierarchyNodeKind;
  children: HierarchyNode[];
}

export function buildHierarchyNodes(
  tree: ModelTreeReader
): HierarchyNode[] {
  const byParent = Map.groupBy(
    tree.values(),
    (node) => node.parentId
  );

  function build(
    parentId: string | null
  ): HierarchyNode[] {
    return foldersFirst(byParent.get(parentId) ?? []).map((node) => {
      return {
        id: node.id,
        name: node.name || kFallbackNames[node.kind],
        kind: node.kind,
        children: build(node.id)
      };
    });
  }

  return build(null);
}

export function findHierarchyNode(
  nodes: readonly HierarchyNode[],
  id: string
): HierarchyNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    const found = findHierarchyNode(
      node.children,
      id
    );
    if (found !== null) {
      return found;
    }
  }

  return null;
}

function foldersFirst(
  nodes: readonly ModelNodeJSON[]
): ModelNodeJSON[] {
  return [
    ...nodes.filter((node) => node.kind === "folder"),
    ...nodes.filter((node) => node.kind === "block")
  ];
}
