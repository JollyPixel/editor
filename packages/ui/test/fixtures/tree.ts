// Import Internal Dependencies
import type { TreeNode } from "../../src/data/tree/contract.ts";

export const TREE: TreeNode[] = [
  {
    id: "a",
    label: "A",
    children: [
      { id: "a1", label: "A1" },
      {
        id: "a2",
        label: "A2",
        children: [
          { id: "a2a", label: "A2A" }
        ]
      }
    ]
  },
  { id: "b", label: "B" }
];

export const FOLDER_TREE: TreeNode[] = [
  { id: "r1", label: "R1" },
  {
    id: "r2",
    label: "R2",
    children: [
      { id: "c1", label: "C1" },
      { id: "c2", label: "C2" }
    ]
  }
];

export const OWNER_TREE: TreeNode[] = [
  {
    id: "folder",
    label: "Folder",
    children: [{ id: "file", label: "File" }]
  },
  { id: "loose", label: "Loose" },
  {
    id: "owner",
    label: "Owner",
    collapsible: false,
    children: [{ id: "companion", label: "Companion" }]
  }
];

export function reparentTree(): TreeNode[] {
  return [
    {
      id: "a",
      label: "A",
      children: [
        { id: "a1", label: "A1" },
        { id: "a2", label: "A2" }
      ]
    },
    { id: "b", label: "B" },
    { id: "c", label: "C" }
  ];
}
