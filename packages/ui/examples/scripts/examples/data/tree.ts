// Import Internal Dependencies
import "../../../../src/containers/context-menu/ContextMenu.ts";
import "../../../../src/data/tree/Tree.ts";
import { findNode, resolveReparent } from "../../../../src/data/tree/model.ts";
import type { ContextMenu } from "../../../../src/containers/context-menu/ContextMenu.ts";
import type { Tree } from "../../../../src/data/tree/Tree.ts";
import type { TreeNode } from "../../../../src/data/tree/contract.ts";
import type {
  GalleryExample,
  GalleryOption,
  GalleryOptionValues
} from "../../types.ts";

type TreeOptionKey =
  | "reorderable"
  | "rowDrag"
  | "multiple"
  | "requireSelection"
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
    key: "requireSelection",
    label: "Require selection",
    initial: false
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
            { color: "#4ad991", title: "Lin" },
            { color: "#e3a21a", title: "Locked by Ada", icon: "lock" }
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
              renamable: true,
              swatch: {
                title: "Material: Glass",
                color: "#8ecae673",
                ring: "#ffb703"
              }
            },
            {
              id: "barrel",
              label: "Barrel",
              icon: "check",
              visible: false,
              locked: false,
              renamable: true,
              swatch: {
                title: "Add material"
              }
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

function rowMenu(
  tree: Tree
): ContextMenu {
  const menu = document.createElement("jolly-context-menu");
  menu.label = "Row actions";
  let target = "";

  tree.addEventListener("jolly-context-request", (event) => {
    const { id, x, y } = event.detail;
    if (id === null) {
      return;
    }
    const visible = findNode(tree.nodes, id)?.visible;
    target = id;
    menu.items = [
      {
        id: "rename",
        label: "Rename",
        disabled: !tree.renamable
      },
      {
        id: "visibility",
        label: visible === false ? "Show" : "Hide",
        icon: "eye",
        disabled: visible === undefined
      }
    ];
    menu.openAt(x, y);
  });
  menu.addEventListener("jolly-context-action", (event) => {
    if (event.detail.id === "rename") {
      tree.beginRename(target);
    }
    else {
      const visible = findNode(tree.nodes, target)?.visible;
      tree.nodes = setNodeField(tree.nodes, target, "visible", visible === false);
    }
  });

  return menu;
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
  options: kOptions,
  render(host, options) {
    const tree = buildTree(options);
    host.append(tree, rowMenu(tree));
  }
};
