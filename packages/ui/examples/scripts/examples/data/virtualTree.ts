// Import Internal Dependencies
import type {
  Tree,
  TreeNode
} from "../../../../src/index.ts";
import type { GalleryExample } from "../../types.ts";

// CONSTANTS
const kFolderCount = 40;
const kAssetsPerFolder = 50;

function folderId(
  folder: number
): string {
  return `folder-${folder}`;
}

function sampleNodes(): TreeNode[] {
  return Array.from({ length: kFolderCount }, (_, folder) => {
    return {
      id: folderId(folder),
      label: `Folder ${folder}`,
      icon: "info",
      renamable: true,
      children: Array.from({ length: kAssetsPerFolder }, (__, asset) => {
        return {
          id: `asset-${folder}-${asset}`,
          label: `Asset ${folder}-${asset}.png`,
          icon: "check",
          detail: "Texture",
          renamable: true
        };
      })
    };
  });
}

function renameNode(
  nodes: TreeNode[],
  id: string,
  label: string
): TreeNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return {
        ...node,
        label
      };
    }

    return node.children === undefined ?
      node :
      {
        ...node,
        children: renameNode(node.children, id, label)
      };
  });
}

function buildTree(): Tree {
  const tree = document.createElement("jolly-tree");
  tree.virtual = true;
  tree.multiple = true;
  tree.renamable = true;
  tree.indentGuides = true;
  tree.nodes = sampleNodes();
  tree.selected = [];
  tree.expanded = Array.from({ length: kFolderCount }, (_, folder) => folderId(folder));

  tree.addEventListener("jolly-select", (event) => {
    tree.selected = event.detail.selected;
  });
  tree.addEventListener("jolly-toggle-expand", (event) => {
    const { id, expanded } = event.detail;
    tree.expanded = expanded ?
      [...tree.expanded, id] :
      tree.expanded.filter((expandedId) => expandedId !== id);
  });
  tree.addEventListener("jolly-rename", (event) => {
    tree.nodes = renameNode(tree.nodes, event.detail.id, event.detail.name);
  });

  return tree;
}

export const VIRTUAL_TREE_EXAMPLE: GalleryExample = {
  id: "data/virtual-tree",
  title: "Virtual tree",
  render(host) {
    const tree = buildTree();
    tree.className = "tree-demo virtual-tree-demo";
    host.append(tree);
  }
};
