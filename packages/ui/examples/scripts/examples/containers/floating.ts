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
    const held = pane(
      "Floating",
      "Drag the title, resize the right and bottom edges, or drag the corner to resize both at once."
    );
    held.collapsible = true;
    floating.append(held);

    return floating;
  }
);
