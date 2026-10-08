// Import Internal Dependencies
import type { GalleryEntry } from "../../types.ts";

export const MONITORS_EXAMPLES: readonly GalleryEntry[] = [
  {
    id: "monitors/monitor",
    title: "Monitor",
    load: async() => (await import("./monitor.ts")).MONITOR_EXAMPLE
  },
  {
    id: "monitors/graph",
    title: "Graph",
    load: async() => (await import("./graph.ts")).GRAPH_EXAMPLE
  }
];
