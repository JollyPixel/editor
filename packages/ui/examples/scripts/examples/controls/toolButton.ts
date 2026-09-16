// Import Internal Dependencies
import { createSimpleExample } from "../shared/example.ts";
import { onFieldChange } from "../../../../src/index.ts";

export const TOOL_BUTTON_EXAMPLE = createSimpleExample(
  "controls/tool-button",
  "Tool button",
  () => {
    const root = document.createElement("div");
    root.className = "chrome-demo";
    root.style.paddingTop = "180px";

    const rail = document.createElement("jolly-rail");
    rail.orientation = "horizontal";

    const add = document.createElement("jolly-tool-button");
    add.icon = "plus";
    add.label = "Add";
    add.active = true;
    add.dataset.testid = "plain";

    const mode = document.createElement("jolly-tool-button");
    mode.icon = "eye";
    mode.label = "Mode";
    mode.flyoutSide = "above";
    mode.dataset.testid = "mode";
    mode.append(document.createTextNode("\n  "));
    for (const icon of ["lock", "search"]) {
      const option = document.createElement("jolly-tool-button");
      option.slot = "flyout";
      option.icon = icon;
      option.label = icon;
      option.flyoutSide = "left";
      option.addEventListener("click", () => {
        mode.icon = icon;
      });
      mode.append(option);
    }

    const size = document.createElement("jolly-tool-button");
    size.label = "Size";
    size.flyoutSide = "above";
    size.dataset.testid = "size";
    const readout = document.createElement("span");
    readout.textContent = "3";
    readout.dataset.testid = "size-value";
    const slider = document.createElement("jolly-slider");
    slider.slot = "flyout";
    slider.orientation = "vertical";
    slider.min = 1;
    slider.max = 8;
    slider.value = 3;
    onFieldChange<number>(slider, (value) => {
      slider.value = value;
      readout.textContent = String(value);
    }, "jolly-input");
    size.append(readout, slider);

    const disabled = document.createElement("jolly-tool-button");
    disabled.icon = "info";
    disabled.label = "Disabled";
    disabled.flyoutSide = "above";
    disabled.disabled = true;
    disabled.dataset.testid = "disabled";
    const hiddenOption = document.createElement("jolly-tool-button");
    hiddenOption.slot = "flyout";
    hiddenOption.icon = "check";
    hiddenOption.label = "Hidden";
    disabled.append(hiddenOption);

    rail.append(add, mode, size, disabled);
    root.append(rail);

    return root;
  }
);
