// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";

// CONSTANTS
const kInitialTabs = [
  "grass",
  "stone"
];

export const TABS_DYNAMIC_EXAMPLE = createSimpleExample(
  "containers/tabs-dynamic",
  "Tabs (dynamic)",
  () => {
    const container = document.createElement("div");
    const element = document.createElement("jolly-tabs");
    element.append(...kInitialTabs.map((value) => tab(value)));
    element.value = kInitialTabs[0];

    let created = 0;
    const addButton = document.createElement("button");
    addButton.id = "tabs-dynamic-add";
    addButton.type = "button";
    addButton.textContent = "Add tab";
    addButton.addEventListener("click", () => {
      created += 1;
      const value = `texture-${created}`;
      element.value = value;
      element.append(tab(value));
    });

    container.append(element, addButton);

    return container;
  }
);

function tab(
  value: string
): HTMLElementTagNameMap["jolly-tab"] {
  const element = document.createElement("jolly-tab");
  element.value = value;
  element.label = value;
  element.textContent = `${value} panel`;

  return element;
}
