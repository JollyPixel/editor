// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Checkbox } from "../../../../src/index.ts";

export const CHECKBOX_EXAMPLE: GalleryExample = {
  id: "controls/checkbox",
  title: "Checkbox",
  group: "Controls",
  render(host) {
    return renderStateMatrix<Checkbox>(host, {
      colored: true,
      create() {
        const field = document.createElement("jolly-checkbox");
        field.label = "Cast shadows";
        field.clickableBackground = true;
        field.value = false;
        field.default = false;

        return field;
      },
      modified(field) {
        field.value = true;
      }
    });
  }
};
