// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { ButtonGroup } from "../../../../src/index.ts";

// CONSTANTS
const kModes = [
  {
    value: "move",
    label: "Move",
    icon: "drag"
  },
  {
    value: "paint",
    label: "Paint",
    icon: "check"
  },
  {
    value: "erase",
    label: "Erase",
    icon: "close"
  },
  {
    value: "pick",
    label: "Pick",
    icon: "eye"
  }
];

export const BUTTON_GROUP_EXAMPLE: GalleryExample = {
  id: "controls/button-group",
  title: "Button group",
  group: "Controls",
  render(host) {
    return renderStateMatrix<ButtonGroup<unknown>>(host, {
      create() {
        const field = document.createElement("jolly-button-group");
        field.label = "Tool";
        field.options = kModes;
        field.value = "move";
        field.default = "move";

        return field;
      },
      modified(field) {
        field.value = "paint";
      }
    });
  }
};
