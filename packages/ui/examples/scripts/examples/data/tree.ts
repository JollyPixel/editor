// Import Internal Dependencies
import {
  resolveReparent,
  type Tree,
  type TreeNode
} from "../../../../src/index.ts";
import type {
  GalleryExample,
  GalleryOption,
  GalleryOptionValues
} from "../../types.ts";

type TreeOptionKey =
  | "reorderable"
  | "rowDrag"
  | "multiple"
  | "renamable"
  | "indentGuides";

// CONSTANTS
const kOptions: GalleryOption<TreeOptionKey>[] = [
  {
    key: "reorderable",
    label: "Reorderable",
    initial: true
  },
  {
    key: "rowDrag",
    label: "Row drag",
    initial: true
  },
  {
    key: "multiple",
    label: "Multi-select",
    initial: true
  },
  {
    key: "renamable",
    label: "Renamable",
    initial: true
  },
  {
    key: "indentGuides",
    label: "Indent guides",
    initial: true
  }
];

function sampleNodes(): TreeNode[] {
  return [
    {
      id: "scene",
      label: "Scene",
      icon: "search",
      visible: true,
      locked: false,
      renamable: true,
      children: [
        {
          id: "camera",
          label: "Camera",
          icon: "info",
          visible: true,
          locked: false,
          renamable: true,
          detail: "2 lights",
          badges: [
            { color: "#e0567a", title: "Ada" },
            { color: "#4ad991", title: "Lin" }
          ]
        },
        {
          id: "props",
          label: "Props",
          icon: "search",
          visible: true,
          locked: false,
          renamable: true,
          children: [
            {
              id: "crate",
              label: "Crate",
              icon: "check",
              visible: true,
              locked: false,
              renamable: true
            },
            {
              id: "barrel",
              label: "Barrel",
              icon: "check",
              visible: false,
              locked: false,
              renamable: true
            }
          ]
        }
      ]
    },
    {
      id: "lighting",
      label: "Lighting",
      icon: "warning",
      visible: true,
      locked: true,
      renamable: true
    }
  ];
}

function setNodeField(
  nodes: TreeNode[],
  id: string,
  field: "locked" | "visible",
  value: boolean
): TreeNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return {
        ...node,
        [field]: value
      };
    }

    return node.children === undefined ?
      node :
      {
        ...node,
        children: setNodeField(node.children, id, field, value)
      };
  });
}

function buildTree(
  options: GalleryOptionValues<TreeOptionKey>
): Tree {
  const tree = document.createElement("jolly-tree");
  tree.className = "tree-demo";
  for (const { key } of kOptions) {
    tree[key] = options[key];
  }
  tree.nodes = sampleNodes();
  tree.selected = [];
  tree.expanded = ["scene", "props"];

  tree.addEventListener("jolly-select", (event) => {
    tree.selected = event.detail.selected;
  });
  tree.addEventListener("jolly-toggle-expand", (event) => {
    const { id, expanded } = event.detail;
    tree.expanded = expanded ?
      [...tree.expanded, id] :
      tree.expanded.filter((expandedId) => expandedId !== id);
  });
  tree.addEventListener("jolly-toggle-visible", (event) => {
    tree.nodes = setNodeField(
      tree.nodes,
      event.detail.id,
      "visible",
      event.detail.visible
    );
  });
  tree.addEventListener("jolly-toggle-lock", (event) => {
    tree.nodes = setNodeField(
      tree.nodes,
      event.detail.id,
      "locked",
      event.detail.locked
    );
  });
  tree.addEventListener("jolly-rename", (event) => {
    const { id, name } = event.detail;
    tree.nodes = renameNode(tree.nodes, id, name);
  });
  tree.addEventListener("jolly-reparent", (event) => {
    tree.nodes = resolveReparent({
      nodes: tree.nodes,
      ...event.detail
    });
  });

  return tree;
}

function renameNode(
  nodes: TreeNode[],
  id: string,
  label: string
): TreeNode[] {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, label };
    }

    return node.children === undefined ?
      node :
      {
        ...node,
        children: renameNode(node.children, id, label)
      };
  });
}

export const TREE_EXAMPLE: GalleryExample<TreeOptionKey> = {
  id: "data/tree",
  title: "Tree",
  options: kOptions,
  render(host, options) {
    host.append(buildTree(options));
  }
};
