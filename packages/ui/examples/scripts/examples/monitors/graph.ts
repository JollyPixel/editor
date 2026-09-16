// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { formatCount } from "../../../../src/index.ts";

export const GRAPH_EXAMPLE: GalleryExample = {
  id: "monitors/graph",
  title: "Graph",
  render(host) {
    const graph = document.createElement("jolly-graph");
    graph.label = "fps";
    graph.min = 0;
    graph.rows = 3;
    graph.format = formatCount;
    host.append(graph);

    let elapsed = 0;
    const timer = window.setInterval(() => {
      elapsed += 1;
      graph.value = 60 + (Math.sin(elapsed / 4) * 20) + ((Math.random() * 6) - 3);
    }, 200);

    return () => window.clearInterval(timer);
  }
};
