// Import Internal Dependencies
import "../../../../src/containers/rail/Rail.ts";
import "../../../../src/containers/rail/RailGroup.ts";
import { createSimpleExample } from "../shared/example.ts";
import {
  button,
  text
} from "../shared/containerBuilders.ts";

export const RAIL_EXAMPLE = createSimpleExample(
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
    const floatingLabel = text("Floating, grouped");
    floatingLabel.className = "scenario-hint";
    const floating = document.createElement("jolly-rail");
    floating.orientation = "horizontal";
    floating.floating = true;
    floating.append(
      group(false, "History", button("U"), button("R")),
      group(true, "Transform", button("M"), button("R"), button("S"))
    );
    root.append(
      verticalLabel,
      vertical,
      horizontalLabel,
      horizontal,
      floatingLabel,
      floating
    );

    return root;
  }
);

function group(
  divided: boolean,
  label: string,
  ...items: HTMLElement[]
): HTMLElementTagNameMap["jolly-rail-group"] {
  const element = document.createElement("jolly-rail-group");
  element.divided = divided;
  element.setAttribute("role", "group");
  element.ariaLabel = label;
  element.append(...items);

  return element;
}
