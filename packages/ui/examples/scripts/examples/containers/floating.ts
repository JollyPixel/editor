// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";
import { pane } from "../shared/containerBuilders.ts";

export const FLOATING_EXAMPLE = createSimpleExample(
  "containers/floating",
  "Floating",
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
    const reset = document.createElement("jolly-button");
    reset.slot = "actions";
    reset.icon = "revert";
    reset.iconOnly = true;
    reset.label = "Reset position";
    reset.addEventListener("click", () => floating.moveTo(280, 48));
    held.prepend(reset);
    floating.append(held);

    return floating;
  }
);
