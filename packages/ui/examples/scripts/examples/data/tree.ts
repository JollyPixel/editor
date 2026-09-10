// Import Internal Dependencies
import {
  detailOf,
  resolveReparent,
  type Tree,
  type TreeNode
} from "../../../../src/index.ts";
import type { GalleryExample } from "../../types.ts";

interface TreeBooleanOption {
  key: "reorderable" | "rowDrag" | "multiple" | "renamable" | "indentGuides";
  label: string;
}

// CONSTANTS
const kOptions: TreeBooleanOption[] = [
  { key: "reorderable", label: "Reorderable" },
  { key: "rowDrag", label: "Row drag" },
  { key: "multiple", label: "Multi-select" },
  { key: "renamable", label: "Renamable" },
  { key: "indentGuides", label: "Indent guides" }
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
            { id: "crate", label: "Crate", icon: "check", visible: true, locked: false, renamable: true },
            { id: "barrel", label: "Barrel", icon: "check", visible: false, locked: false, renamable: true }
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

function buildTree(): Tree {
  const tree = document.createElement("jolly-tree");
  tree.reorderable = true;
  tree.rowDrag = true;
  tree.multiple = true;
  tree.renamable = true;
  tree.indentGuides = true;
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
    tree.nodes = setNodeField(tree.nodes, event.detail.id, "visible", event.detail.visible);
  });
  tree.addEventListener("jolly-toggle-lock", (event) => {
    tree.nodes = setNodeField(tree.nodes, event.detail.id, "locked", event.detail.locked);
  });
  tree.addEventListener("jolly-rename", (event) => {
    const { id, name } = event.detail;
    tree.nodes = renameNode(tree.nodes, id, name);
  });
  tree.addEventListener("jolly-reparent", (event) => {
    tree.nodes = resolveReparent({ nodes: tree.nodes, ...event.detail });
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

/** One checkbox per boolean property, writing straight back onto `tree` on change. */
function buildOptionsPanel(
  tree: Tree
): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "tree-demo-options";

  const heading = document.createElement("h3");
  heading.textContent = "Options";
  panel.append(heading);

  for (const option of kOptions) {
    const checkbox = document.createElement("jolly-checkbox");
    checkbox.label = option.label;
    checkbox.clickableBackground = true;
    checkbox.value = tree[option.key];
    checkbox.addEventListener("jolly-change", (event) => {
      const detail = detailOf<{ value: boolean; }>(event);
      if (detail !== null) {
        tree[option.key] = detail.value;
      }
    });
    panel.append(checkbox);
  }

  return panel;
}

export const TREE_EXAMPLE: GalleryExample = {
  id: "data/tree",
  title: "Tree",
  group: "Data views",
  render(host) {
    const root = document.createElement("div");
    root.className = "tree-demo";

    const tree = buildTree();
    root.append(tree, buildOptionsPanel(tree));
    host.append(root);

    return () => root.remove();
  }
};
