// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import { renderStateMatrix } from "../../stateMatrix.ts";
import { Toggle } from "../../../../src/controls/Toggle.ts";

export const TOGGLE_EXAMPLE: GalleryExample = {
  render(host) {
    return renderStateMatrix<Toggle>(host, {
      colored: true,
      create() {
        const field = document.createElement("jolly-toggle");
        field.label = "Cast shadows";
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
