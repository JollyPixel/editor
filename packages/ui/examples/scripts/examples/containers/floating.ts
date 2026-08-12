// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";
import { pane } from "../shared/containerBuilders.ts";

export const FLOATING_EXAMPLE = createSimpleExample(
  "containers/floating",
  "Floating",
  "Containers",
  () => {
    const floating = document.createElement("jolly-floating");
    floating.x = 280;
    floating.y = 48;
    floating.storageKey = "gallery-example:floating";
    floating.append(pane("Floating", "Drag the title or resize the right and bottom edges."));

    return floating;
  }
);
