// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Select } from "../../../../src/index.ts";

// CONSTANTS
const kFilters = [
  {
    value: "nearest",
    label: "Nearest"
  },
  {
    value: "linear",
    label: "Linear"
  },
  {
    value: "mipmap",
    label: "Mipmap"
  },
  {
    value: "anisotropic",
    label: "Anisotropic",
    disabled: true
  }
];

export const SELECT_EXAMPLE: GalleryExample = {
  id: "controls/select",
  title: "Select",
  group: "Controls",
  render(host) {
    return renderStateMatrix<Select<unknown>>(host, {
      create() {
        const field = document.createElement("jolly-select");
        field.label = "Texture filter";
        field.options = kFilters;
        field.value = "nearest";
        field.default = "nearest";

        return field;
      },
      modified(field) {
        field.value = "linear";
      }
    });
  }
};
