// Import Internal Dependencies
import {
  resolveReparent,
  type TreeNode
} from "../../../../src/index.ts";
import { createSimpleExample } from "../shared/example.ts";

function sampleNodes(): TreeNode[] {
  return [
    {
      id: "scene",
      label: "Scene",
      icon: "search",
      visible: true,
      locked: false,
      children: [
        { id: "camera", label: "Camera", icon: "info", visible: true, locked: false },
        {
          id: "props",
          label: "Props",
          icon: "search",
          visible: true,
          locked: false,
          children: [
            { id: "crate", label: "Crate", icon: "check", visible: true, locked: false },
            { id: "barrel", label: "Barrel", icon: "check", visible: false, locked: false }
          ]
        }
      ]
    },
    { id: "lighting", label: "Lighting", icon: "warning", visible: true, locked: true }
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

export const TREE_EXAMPLE = createSimpleExample(
  "data/tree",
  "Tree",
  "Data views",
  () => {
    const tree = document.createElement("jolly-tree");
    tree.reorderable = true;
    tree.rowDrag = true;
    tree.multiple = true;
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
    tree.addEventListener("jolly-reparent", (event) => {
      tree.nodes = resolveReparent({ nodes: tree.nodes, ...event.detail });
    });

    return tree;
  }
);
