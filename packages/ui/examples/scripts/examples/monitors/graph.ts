// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { formatCount } from "../../../../src/index.ts";

export const GRAPH_EXAMPLE: GalleryExample = {
  id: "monitors/graph",
  title: "Graph",
  group: "Monitors",
  render(host) {
    const graph = document.createElement("jolly-graph");
    graph.label = "fps";
    // No max: it auto-scales to the observed peak rather than a guessed ceiling.
    graph.min = 0;
    graph.rows = 3;
    graph.format = formatCount;
    host.append(graph);

    let elapsed = 0;
    const timer = window.setInterval(() => {
      elapsed += 1;
      graph.value = 60 + (Math.sin(elapsed / 4) * 20) + ((Math.random() * 6) - 3);
    }, 200);

    return () => {
      window.clearInterval(timer);
      graph.remove();
    };
  }
};
