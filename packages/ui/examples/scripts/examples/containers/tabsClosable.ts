// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";

export const TABS_CLOSABLE_EXAMPLE = createSimpleExample(
  "containers/tabs-closable",
  "Tabs (closable)",
  "Containers",
  () => {
    const element = document.createElement("jolly-tabs");
    element.append(
      tab("grass", "grass"),
      tab("stone", "stone"),
      tab("water", "water")
    );
    element.addEventListener("jolly-tab-close", (event) => {
      const closed = [...element.querySelectorAll("jolly-tab")].find(
        (child) => child.value === event.detail.value
      );
      closed?.remove();
    });

    return element;
  }
);

function tab(
  value: string,
  label: string
): HTMLElementTagNameMap["jolly-tab"] {
  const element = document.createElement("jolly-tab");
  element.value = value;
  element.label = label;
  element.closable = true;
  element.textContent = `${label} panel`;

  return element;
}
