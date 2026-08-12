// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";
import {
  button,
  text
} from "../shared/containerBuilders.ts";

export const RAIL_EXAMPLE = createSimpleExample(
  "containers/rail",
  "Rail",
  "Containers",
  () => {
    const root = document.createElement("div");
    root.className = "chrome-demo";
    const verticalLabel = text("Vertical");
    verticalLabel.className = "scenario-hint";
    const vertical = document.createElement("jolly-rail");
    vertical.append(button("M"), button("R"), button("S"));
    const horizontalLabel = text("Horizontal");
    horizontalLabel.className = "scenario-hint";
    const horizontal = document.createElement("jolly-rail");
    horizontal.orientation = "horizontal";
    horizontal.append(button("M"), button("R"), button("S"));
    root.append(verticalLabel, vertical, horizontalLabel, horizontal);

    return root;
  }
);
