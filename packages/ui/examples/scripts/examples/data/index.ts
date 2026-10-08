// Import Internal Dependencies
import type { GalleryEntry } from "../../types.ts";

export const DATA_EXAMPLES: readonly GalleryEntry[] = [
  {
    id: "data/tree",
    title: "Tree",
    load: async() => (await import("./tree.ts")).TREE_EXAMPLE
  },
  {
    id: "data/virtual-tree",
    title: "Virtual tree",
    load: async() => (await import("./virtualTree.ts")).VIRTUAL_TREE_EXAMPLE
  }
];
