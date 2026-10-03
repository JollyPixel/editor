// Import Third-party Dependencies
import type {
  ModelMaterialJSON,
  ModelNodeKind,
  ModelTreeReader
} from "@jolly-pixel/asset.voxel-model/client";

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
  /** `null` for a block without a material and for a folder. */
  material: ModelMaterialJSON | null;
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
    return (byParent.get(parentId) ?? []).map((node) => {
      return {
        id: node.id,
        name: node.name || kFallbackNames[node.kind],
        kind: node.kind,
        material: node.kind === "block" && node.materialId !== undefined ?
          tree.materials.material(node.materialId) ?? null :
          null,
        children: build(node.id)
      };
    });
  }

  return build(null);
}

export function* blockIdsUnder(
  node: HierarchyNode
): IterableIterator<string> {
  for (const child of node.children) {
    if (child.kind === "block") {
      yield child.id;
    }
    yield* blockIdsUnder(child);
  }
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
