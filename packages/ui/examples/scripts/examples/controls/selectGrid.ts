// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Select } from "../../../../src/controls/Select.ts";

// CONSTANTS
const kTools = [
  {
    value: "move",
    label: "Move",
    icon: "drag",
    group: "Edit"
  },
  {
    value: "add",
    label: "Add",
    icon: "plus",
    group: "Edit"
  },
  {
    value: "remove",
    label: "Remove",
    icon: "close",
    group: "Edit"
  },
  {
    value: "accept",
    label: "Accept",
    icon: "check",
    group: "Edit"
  },
  {
    value: "lock",
    label: "Lock",
    icon: "lock",
    group: "Edit"
  },
  {
    value: "look",
    label: "Look",
    icon: "eye",
    group: "Inspect"
  },
  {
    value: "search",
    label: "Search",
    icon: "search",
    group: "Inspect"
  },
  {
    value: "warn",
    label: "Warn",
    icon: "warning",
    group: "Inspect",
    disabled: true
  },
  {
    value: "info",
    label: "Info",
    icon: "info",
    group: "Inspect"
  }
];

export const SELECT_GRID_EXAMPLE: GalleryExample = {
  render(host) {
    return renderStateMatrix<Select<unknown>>(host, {
      create() {
        const field = document.createElement("jolly-select");
        field.label = "Tool";
        field.layout = "grid";
        field.columns = 3;
        field.options = kTools;
        field.value = "move";
        field.default = "move";

        return field;
      },
      modified(field) {
        field.value = "look";
      }
    });
  }
};
