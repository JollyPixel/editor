// Import Internal Dependencies
import type { ModelBlocks } from "./ModelBlocks.ts";
import type { ModelFolders } from "./ModelFolders.ts";

export type HierarchyNodeKind =
  | "block"
  | "folder";

export interface HierarchyNode {
  id: string;
  name: string;
  kind: HierarchyNodeKind;
  children: HierarchyNode[];
}

interface FlatNode {
  id: string;
  name: string;
  kind: HierarchyNodeKind;
  parentId: string | null;
}

export function buildHierarchyNodes(
  blocks: ModelBlocks,
  folders: ModelFolders
): HierarchyNode[] {
  const flatNodes: FlatNode[] = [];
  for (const [id, folder] of folders.folders) {
    flatNodes.push({
      id,
      name: folder.name || "Folder",
      kind: "folder",
      parentId: folder.parentId
    });
  }
  for (const block of blocks.values()) {
    flatNodes.push({
      id: block.uuid,
      name: block.name || "Block",
      kind: "block",
      parentId: folders.placements.get(
        block.uuid
      ) ?? blocks.parentOf(block.uuid)
    });
  }

  const byParent = Map.groupBy(
    flatNodes,
    (node) => node.parentId
  );

  function build(
    parentId: string | null
  ): HierarchyNode[] {
    return (byParent.get(parentId) ?? []).map((node) => {
      return {
        id: node.id,
        name: node.name,
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

export function findHierarchyParentId(
  nodes: readonly HierarchyNode[],
  id: string,
  parentId: string | null = null
): string | null | undefined {
  for (const node of nodes) {
    if (node.id === id) {
      return parentId;
    }

    const found = findHierarchyParentId(
      node.children,
      id,
      node.id
    );
    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

export function collectHierarchyIds(
  node: HierarchyNode
): string[] {
  return [
    node.id,
    ...node.children.flatMap(collectHierarchyIds)
  ];
}
