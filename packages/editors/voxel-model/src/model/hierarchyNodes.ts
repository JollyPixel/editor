// Import Third-party Dependencies
import {
  blockNameClashes,
  type ModelMaterialJSON,
  type ModelNodeKind,
  type ModelTreeReader
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  blockNameClashMessage,
  displayNameOf
} from "./nodeNames.ts";

export type HierarchyNodeKind = ModelNodeKind;

export interface HierarchyNode {
  id: string;
  name: string;
  kind: HierarchyNodeKind;
  /**
   * `null` for a block without a material and for a folder.
   */
  material: ModelMaterialJSON | null;
  /**
   * Set when the block shares its name with a sibling block.
   */
  nameClash?: string;
  children: HierarchyNode[];
}

export function buildHierarchyNodes(
  tree: ModelTreeReader
): HierarchyNode[] {
  const byParent = Map.groupBy(
    tree.values(),
    (node) => node.parentId
  );
  const clashes = blockNameClashes(tree);

  function build(
    parentId: string | null
  ): HierarchyNode[] {
    return (byParent.get(parentId) ?? []).map((node) => {
      const name = displayNameOf(node);

      return {
        id: node.id,
        name,
        kind: node.kind,
        material: node.kind === "block" && node.materialId !== undefined ?
          tree.materials.material(node.materialId) ?? null :
          null,
        ...clashes.has(node.id) ?
          { nameClash: blockNameClashMessage(tree, node.id, name) } :
          {},
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
